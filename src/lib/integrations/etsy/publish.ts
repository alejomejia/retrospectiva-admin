import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { etsyOauth, productVideos, products } from "@/lib/db/schema";
import { listImagesForEtsyPublish } from "@/lib/products/etsy-publish-payload";
import { FEATURED_LISTING_CAP } from "@/lib/products/featured";
import {
  appendListingFooter,
  resolveListingFooter,
} from "@/lib/products/listing-footer";
import { getProductSettings } from "@/lib/products/settings";
import { buildSlug } from "@/lib/products/slug";
import { fetchBytesFromR2 } from "@/lib/integrations/r2/fetch";
import {
  TRANSLATABLE_FIELDS,
  runTranslation,
  type TranslatableField,
} from "@/lib/integrations/openai/translate";
import { websiteWebhookQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import {
  ListingMapperError,
  mapProductToCreateDraftPayload,
} from "./listing-mapper";
import {
  createDraftListing,
  deleteListingImage,
  getFeaturedListings,
  getListingImages,
  getListingVideos,
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
 * `docs/overview/project-conventions.md` §1.
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

export async function translateWithRetry(
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

export function extFromR2Key(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return "bin";
  return key.slice(dot + 1).toLowerCase();
}

export function contentTypeForImage(ext: string): string {
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

export function contentTypeForVideo(ext: string, fallback: string | null): string {
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

/**
 * Whether the shop has no free featured slot. Etsy caps featured
 * listings at 4 shop-wide and rejects the entire listing
 * create/update once full, so a featured publish must be cancelled
 * up front rather than attempted. `currentListingId` (re-publish
 * path) is excluded from the count so re-pushing an already-featured
 * listing doesn't count itself toward the cap.
 */
export async function isFeaturedSlotFull(
  shopId: number,
  currentListingId?: number,
): Promise<boolean> {
  const featured = await getFeaturedListings(shopId);
  const others = featured.filter((l) => l.listing_id !== currentListingId);
  return others.length >= FEATURED_LISTING_CAP;
}

/**
 * Pre-publish featured-cap gate. Returns `true` when the product is
 * flagged featured but the shop already holds the maximum featured
 * listings — the caller must cancel the publish and tell the
 * operator to un-feature first. Non-featured products never query
 * Etsy. Resolves the shop from `etsy_oauth`.
 */
export async function featuredSlotFullForProduct(
  isFeatured: boolean,
  currentListingId?: number,
): Promise<boolean> {
  if (!isFeatured) return false;
  const shop = await loadShopConfig();
  return isFeaturedSlotFull(shop.shopId, currentListingId);
}

export async function loadShopConfig() {
  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) {
    throw new Error("etsy_oauth row missing — connect the shop first");
  }
  return {
    shopId: row.shopId,
    returnPolicyId: row.defaultReturnPolicyId,
    readinessStateId: row.defaultReadinessStateId,
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

  const shop = await loadShopConfig();

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

  // Resolve the listing footer (per-product override, else shop-wide
  // default). Appended to the description at the payload boundary only
  // — both members are pre-translated, so this never touches OpenAI.
  const footer = resolveListingFooter(product, await getProductSettings());

  let payload;
  try {
    payload = mapProductToCreateDraftPayload({
      product,
      shop,
      footerEn: footer.en,
    });
  } catch (err) {
    if (err instanceof ListingMapperError) {
      throw new Error(`listing mapper rejected product: ${err.message}`);
    }
    throw err;
  }

  // Featured-cap fallback. The interactive publish action already
  // gates this, but a *scheduled* job can fire after the shop filled
  // its 4 featured slots during the delay window. With no operator
  // watching, publish unfeatured rather than failing — strip
  // `featured_rank` so Etsy accepts the create.
  if (payload.featured_rank && (await isFeaturedSlotFull(shop.shopId))) {
    delete payload.featured_rank;
    dev.warn("featured cap reached — publishing unfeatured", productId);
  }

  // Resume an interrupted publish instead of orphaning a fresh draft
  // on every retry. A prior attempt persists `etsyListingId` the
  // moment the draft is created (below), so if it's already set we
  // reuse that draft — push the current payload via updateListing and
  // wipe its existing images so the re-upload doesn't duplicate them.
  // Only the first attempt actually calls createDraftListing.
  let listingId: number;
  let etsyState: string;
  if (row.etsyListingId != null) {
    const updated = await updateListing(shop.shopId, row.etsyListingId, payload);
    listingId = row.etsyListingId;
    etsyState = updated.state ?? "draft";
    const existing = await getListingImages(shop.shopId, listingId);
    for (const img of existing) {
      await deleteListingImage(shop.shopId, listingId, img.listing_image_id);
    }
    dev.log("draft listing reused", productId, `listingId=${listingId}`);
  } else {
    // Persist the listing_id immediately so a mid-flow crash leaves a
    // draft this resume path can pick up rather than orphaning it.
    const draft = await createDraftListing(shop.shopId, payload);
    await db
      .update(products)
      .set({
        etsyListingId: draft.listing_id,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, productId));
    listingId = draft.listing_id;
    etsyState = draft.state ?? "draft";
    dev.log("draft listing created", productId, `listingId=${listingId}`);
  }

  // Upload images in stored order. Rank is 1-indexed; rank=1 becomes
  // Etsy's cover image (originals[0] in our list, by design). Uploads
  // are sequential (awaited one at a time), so Etsy honors each
  // `rank` — there is no separate reorder PUT. NOTE: do NOT send
  // `image_ids` to updateListing to reorder; it isn't a writable
  // param on that endpoint and Etsy 404s the whole request.
  const images = await listImagesForEtsyPublish(productId);
  const altText = (product.titleEn ?? "").trim() || undefined;
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const { bytes, contentType } = await fetchBytesFromR2({ key: img.r2Key });
    const ext = extFromR2Key(img.r2Key);
    await uploadListingImage(shop.shopId, listingId, {
      bytes,
      filename: `image-${i + 1}.${ext}`,
      contentType: contentType ?? contentTypeForImage(ext),
      rank: i + 1,
      altText,
    });
  }
  dev.log("images uploaded", productId, `count=${images.length}`);

  // Optional video (at most one per listing). On the resume path the
  // draft may already carry the video from a prior attempt — skip the
  // re-upload so we don't trip Etsy's one-video limit.
  const [video] = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .limit(1);
  if (video) {
    const existingVideos =
      row.etsyListingId != null
        ? await getListingVideos(shop.shopId, listingId)
        : [];
    if (existingVideos.length > 0) {
      dev.log("video already present — skipping upload", productId);
    } else {
      const { bytes, contentType } = await fetchBytesFromR2({
        key: video.r2Key,
      });
      const ext = extFromR2Key(video.r2Key);
      await uploadListingVideo(shop.shopId, listingId, {
        bytes,
        filename: `video.${ext}`,
        contentType: contentType ?? contentTypeForVideo(ext, video.mimeType),
        name: `video.${ext}`,
      });
      dev.log("video uploaded", productId);
    }
  }

  // ES translation — the EU-Spain visitor sees the canonical copy.
  const titleEs = (product.titleEs ?? "").trim();
  const descriptionEs = (product.descriptionEs ?? "").trim();
  if (titleEs && descriptionEs) {
    await upsertListingTranslation(shop.shopId, listingId, "es", {
      title: titleEs,
      description: appendListingFooter(descriptionEs, footer.es),
      tags: product.etsyTagsEs.length > 0 ? product.etsyTagsEs : undefined,
    });
    dev.log("es translation upserted", productId);
  }

  // Activate the listing — gated by ETSY_ACTIVATE_ON_PUBLISH. While
  // disabled (default), the listing remains an Etsy draft so the
  // operator can manually verify the upload before going live.
  let finalEtsyState = etsyState;
  if (shouldActivateListing()) {
    const active = await updateListing(shop.shopId, listingId, {
      state: "active",
    });
    finalEtsyState = active.state ?? "active";
  } else {
    dev.log("activation skipped (ETSY_ACTIVATE_ON_PUBLISH=false)", productId);
  }

  // Freeze the public store slug on first publish. Once set it never
  // changes (even if the title is later edited) so shared / indexed
  // website URLs stay valid — see `buildSlug`.
  const slug = row.slug ?? buildSlug(row.titleEs, row.id);

  await db
    .update(products)
    .set({
      status: "published",
      slug,
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, productId));

  dev.log(
    "publish complete",
    productId,
    `listingId=${listingId}`,
    `etsyState=${finalEtsyState}`,
  );

  // Fire-and-forget website revalidation. The enqueue itself is
  // best-effort: a Redis hiccup here must not flip the publish back
  // to failed, because the listing is already live on Etsy. The
  // BullMQ retry policy covers transient website failures inside
  // the worker. jobId scopes coalescing per-product per-kind so a
  // double-publish doesn't enqueue twice.
  try {
    await websiteWebhookQueue.add(
      "publish",
      { productId, kind: "publish" },
      { jobId: `publish:${productId}` },
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    dev.warn("website webhook enqueue failed (non-fatal)", productId, m);
  }

  return { ok: true, skipped: false, listingId };
}
