import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { etsyOauth, productVideos, products } from "@/lib/db/schema";
import { listImagesForEtsyPublish } from "@/lib/products/etsy-publish-payload";
import { fetchBytesFromR2 } from "@/lib/integrations/r2/fetch";
import {
  TRANSLATABLE_FIELDS,
  runTranslation,
  type TranslatableField,
} from "@/lib/integrations/openai/translate";
import { devGroup } from "@/lib/utils/dev";

import {
  ListingMapperError,
  mapProductToCreateDraftPayload,
} from "./listing-mapper";
import {
  createDraftListing,
  updateListing,
  uploadListingImage,
  uploadListingVideo,
  upsertListingTranslation,
} from "./listings";

const dev = devGroup("etsy.publish");

/**
 * Default `false` — listings ship as Etsy drafts during the
 * pre-launch verification window so the operator can eyeball the
 * payload in the Etsy seller dashboard before going live. Flip the
 * env to `true` (or `1`) to activate listings as part of the
 * publish flow. NOTE: read directly from `process.env` because the
 * BullMQ worker can't import `@/lib/utils/config` — see
 * `docs/project-conventions.md` §1.
 */
function shouldActivateListing(): boolean {
  const v = process.env.ETSY_ACTIVATE_ON_PUBLISH;
  return v === "true" || v === "1";
}

/**
 * Phase 4c real publish processor. Runs from the `etsy-publish`
 * BullMQ worker for both scheduled and on-demand publishes.
 *
 * Sequence:
 *   1. Status guard (same race-safety check as the Task 9 stub —
 *      cancelled/archived rows skip cleanly without contacting Etsy).
 *   2. Inline ES → EN translation for the four translatable fields,
 *      with bounded per-field retry. Translation failures abort the
 *      publish so we never push a half-translated listing to buyers.
 *   3. Build the create-draft payload via the listing-mapper, then
 *      `createDraftListing`. The returned listing_id is persisted
 *      immediately so a mid-flow crash leaves an Etsy draft we can
 *      resume rather than orphan + re-create.
 *   4. Upload images (rank starts at 1; alt_text = titleEn) and the
 *      optional video.
 *   5. Upsert the ES translation (title + description + tags) so EU
 *      buyers browsing in Spanish see the canonical copy.
 *   6. Flip Etsy state to `active` and the local row to `published`.
 *
 * Throws on any unrecoverable failure; the BullMQ worker catches and
 * the job is retried per its `defaultJobOptions` (3 attempts,
 * exponential backoff).
 */
export type ScheduledPublishResult =
  | { ok: true; skipped: false; listingId: number }
  | { ok: true; skipped: true; reason: "missing" | "status" };

const TRANSLATION_ATTEMPTS = 3;
const TRANSLATION_RETRY_BASE_DELAY_MS = 500;

async function translateWithRetry(
  productId: string,
  field: TranslatableField,
): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= TRANSLATION_ATTEMPTS; attempt++) {
    try {
      await runTranslation(productId, field);
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      dev.warn(
        `translation attempt ${attempt}/${TRANSLATION_ATTEMPTS} failed`,
        productId,
        field,
        msg,
      );
      if (attempt < TRANSLATION_ATTEMPTS) {
        const delay = TRANSLATION_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `translation failed after ${TRANSLATION_ATTEMPTS} attempts (${field}): ${msg}`,
  );
}

function extFromR2Key(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return "bin";
  return key.slice(dot + 1).toLowerCase();
}

function contentTypeForImage(ext: string): string {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function contentTypeForVideo(ext: string, fallback: string | null): string {
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return fallback ?? "video/mp4";
  }
}

async function loadShopConfig() {
  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) {
    throw new Error("etsy_oauth row missing — connect the shop first");
  }
  return {
    shopId: row.shopId,
    shippingProfileId: row.defaultShippingProfileId,
    returnPolicyId: row.defaultReturnPolicyId,
    markupPercent: row.markupPercent,
  };
}

export async function runScheduledPublish(
  productId: string,
): Promise<ScheduledPublishResult> {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) {
    dev.log("skipped (row missing)", productId);
    return { ok: true, skipped: true, reason: "missing" };
  }
  if (row.status !== "scheduled" && row.status !== "draft") {
    dev.log(`skipped (status=${row.status})`, productId);
    return { ok: true, skipped: true, reason: "status" };
  }

  // Translate ES → EN inline. We retry per-field rather than letting
  // one transient OpenAI hiccup abort the whole publish. If retries
  // are exhausted, we throw — the BullMQ retry loop catches it and
  // tries the publish again later.
  for (const field of TRANSLATABLE_FIELDS) {
    await translateWithRetry(productId, field);
  }

  // Re-read after translation so the mapper sees the freshly-written
  // EN columns.
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`product ${productId} disappeared after translation`);
  }

  const shop = await loadShopConfig();

  let payload;
  try {
    payload = mapProductToCreateDraftPayload({ product, shop });
  } catch (err) {
    if (err instanceof ListingMapperError) {
      throw new Error(`listing mapper rejected product: ${err.message}`);
    }
    throw err;
  }

  // `createDraftListing` is the only step where we'd leak an Etsy
  // draft on crash. Persist the listing_id immediately so a retry
  // can resume against the existing draft via updateListing instead
  // of orphaning it.
  const draft = await createDraftListing(shop.shopId, payload);
  await db
    .update(products)
    .set({
      etsyListingId: draft.listing_id,
      etsyState: draft.state ?? "draft",
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, productId));
  dev.log("draft listing created", productId, `listingId=${draft.listing_id}`);

  // Upload images in stored order. Rank is 1-indexed; rank=1 becomes
  // Etsy's cover image (originals[0] in our list, by design).
  const images = await listImagesForEtsyPublish(productId);
  const altText = (product.titleEn ?? "").trim() || undefined;
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const { bytes, contentType } = await fetchBytesFromR2({ key: img.r2Key });
    const ext = extFromR2Key(img.r2Key);
    await uploadListingImage(shop.shopId, draft.listing_id, {
      bytes,
      filename: `image-${i + 1}.${ext}`,
      contentType: contentType ?? contentTypeForImage(ext),
      rank: i + 1,
      altText,
    });
  }
  dev.log("images uploaded", productId, `count=${images.length}`);

  // Optional video (at most one per listing).
  const [video] = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .limit(1);
  if (video) {
    const { bytes, contentType } = await fetchBytesFromR2({
      key: video.r2Key,
    });
    const ext = extFromR2Key(video.r2Key);
    await uploadListingVideo(shop.shopId, draft.listing_id, {
      bytes,
      filename: `video.${ext}`,
      contentType: contentType ?? contentTypeForVideo(ext, video.mimeType),
    });
    dev.log("video uploaded", productId);
  }

  // ES translation — the EU-Spain visitor sees the canonical copy.
  const titleEs = (product.titleEs ?? "").trim();
  const descriptionEs = (product.descriptionEs ?? "").trim();
  if (titleEs && descriptionEs) {
    await upsertListingTranslation(shop.shopId, draft.listing_id, "es", {
      title: titleEs,
      description: descriptionEs,
      tags: product.etsyTagsEs.length > 0 ? product.etsyTagsEs : undefined,
    });
    dev.log("es translation upserted", productId);
  }

  // Activate the listing — gated by ETSY_ACTIVATE_ON_PUBLISH. While
  // disabled (default), the listing remains an Etsy draft so the
  // operator can manually verify the upload before going live.
  let finalEtsyState = draft.state ?? "draft";
  if (shouldActivateListing()) {
    const active = await updateListing(shop.shopId, draft.listing_id, {
      state: "active",
    });
    finalEtsyState = active.state ?? "active";
  } else {
    dev.log("activation skipped (ETSY_ACTIVATE_ON_PUBLISH=false)", productId);
  }

  await db
    .update(products)
    .set({
      status: "published",
      etsyState: finalEtsyState,
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, productId));

  dev.log(
    "publish complete",
    productId,
    `listingId=${draft.listing_id}`,
    `etsyState=${finalEtsyState}`,
  );
  return { ok: true, skipped: false, listingId: draft.listing_id };
}
