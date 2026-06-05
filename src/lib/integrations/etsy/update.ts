import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { productVideos, products } from "@/lib/db/schema";
import { listImagesForEtsyPublish } from "@/lib/products/etsy-publish-payload";
import {
  appendListingFooter,
  resolveListingFooter,
} from "@/lib/products/listing-footer";
import { getProductSettings } from "@/lib/products/settings";
import { fetchBytesFromR2 } from "@/lib/integrations/r2/fetch";
import { TRANSLATABLE_FIELDS } from "@/lib/integrations/openai/translate";
import { websiteWebhookQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import {
  ListingMapperError,
  mapProductToCreateDraftPayload,
} from "./listing-mapper";
import {
  deleteListingImage,
  deleteListingVideo,
  listListingImages,
  listListingVideos,
  updateListing,
  uploadListingImage,
  uploadListingVideo,
  upsertListingTranslation,
} from "./listings";
import {
  contentTypeForImage,
  contentTypeForVideo,
  extFromR2Key,
  isFeaturedSlotFull,
  loadShopConfig,
  translateWithRetry,
} from "./publish";

const dev = devGroup("etsy.update");

/**
 * Pushes the current product state to its existing Etsy listing.
 *
 * Sequence mirrors `runScheduledPublish` but skips draft creation
 * and listing-id persistence (the listing already exists). Media
 * is fully re-synced: prior images/video are deleted, current R2
 * media is re-uploaded, then bulk-reorder lands the canonical
 * ordering on Etsy.
 *
 *   1. Status guard — must be `published` or `scheduled` AND have
 *      a non-null `etsy_listing_id`. Anything else returns skipped.
 *   2. Inline ES → EN translation for the four translatable fields
 *      with bounded per-field retry (reuses publish helper).
 *   3. Build the listing payload via the same mapper used for
 *      publish; spread as an update patch.
 *   4. `updateListing` for text/price/tags/materials/translatables.
 *   5. Delete every existing Etsy listing image; re-upload from R2;
 *      bulk reorder via `updateListing({image_ids})`.
 *   6. Delete every existing Etsy listing video; re-upload from R2
 *      if the product has a video.
 *   7. Upsert ES translation.
 *   8. Bump local `updatedAt` + fire website webhook (kind=publish
 *      so the website cache revalidates).
 *
 * Throws on any unrecoverable failure; the BullMQ worker catches
 * and retries per its `defaultJobOptions`.
 */
export type EtsyUpdateResult =
  | { ok: true; skipped: false; listingId: number }
  | { ok: true; skipped: true; reason: "missing" | "status" | "no_listing_id" };

export async function runEtsyListingUpdate(
  productId: string,
): Promise<EtsyUpdateResult> {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) {
    dev.log("skipped (row missing)", productId);
    return { ok: true, skipped: true, reason: "missing" };
  }
  if (row.status !== "published" && row.status !== "scheduled") {
    dev.log(`skipped (status=${row.status})`, productId);
    return { ok: true, skipped: true, reason: "status" };
  }
  if (row.etsyListingId == null) {
    dev.log("skipped (no etsy_listing_id)", productId);
    return { ok: true, skipped: true, reason: "no_listing_id" };
  }

  const listingId = Number(row.etsyListingId);

  const shop = await loadShopConfig();

  for (const field of TRANSLATABLE_FIELDS) {
    await translateWithRetry(productId, field);
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`product ${productId} disappeared after translation`);
  }

  // Resolve the listing footer (per-product override, else shop-wide
  // default) so a re-sync re-appends the same boilerplate the original
  // publish added. Pre-translated; no OpenAI call here.
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

  // Featured-cap fallback (background worker, no operator watching).
  // Exclude this listing from the count so an already-featured listing
  // keeps its slot; strip `featured_rank` only when 4 *other* listings
  // hold them — Etsy would 400 the whole update otherwise. The other
  // field/media changes still sync; the listing just stays unfeatured.
  if (
    payload.featured_rank &&
    (await isFeaturedSlotFull(shop.shopId, listingId))
  ) {
    delete payload.featured_rank;
    dev.warn("featured cap reached — updating unfeatured", productId);
  }

  await updateListing(shop.shopId, listingId, payload);
  dev.log("listing fields updated", productId, `listingId=${listingId}`);

  const existingImages = await listListingImages(shop.shopId, listingId);
  for (const img of existingImages) {
    await deleteListingImage(shop.shopId, listingId, img.listing_image_id);
  }
  dev.log("prior images deleted", productId, `count=${existingImages.length}`);

  const images = await listImagesForEtsyPublish(productId);
  const altText = (product.titleEn ?? "").trim() || undefined;
  const imageIds: number[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const { bytes, contentType } = await fetchBytesFromR2({ key: img.r2Key });
    const ext = extFromR2Key(img.r2Key);
    const uploaded = await uploadListingImage(shop.shopId, listingId, {
      bytes,
      filename: `image-${i + 1}.${ext}`,
      contentType: contentType ?? contentTypeForImage(ext),
      rank: i + 1,
      altText,
    });
    imageIds.push(uploaded.listing_image_id);
  }
  if (imageIds.length > 1) {
    await updateListing(shop.shopId, listingId, { image_ids: imageIds });
  }
  dev.log("images re-uploaded", productId, `count=${images.length}`);

  const existingVideos = await listListingVideos(shop.shopId, listingId);
  for (const v of existingVideos) {
    await deleteListingVideo(shop.shopId, listingId, v.video_id);
  }
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
    await uploadListingVideo(shop.shopId, listingId, {
      bytes,
      filename: `video.${ext}`,
      contentType: contentType ?? contentTypeForVideo(ext, video.mimeType),
      name: `video.${ext}`,
    });
    dev.log("video re-uploaded", productId);
  }

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

  await db
    .update(products)
    .set({ updatedAt: sql`now()` })
    .where(eq(products.id, productId));

  // jobId `update:${productId}` lets website webhook coalesce
  // back-to-back updates on the same product into a single
  // revalidation, matching the publish-side pattern.
  try {
    await websiteWebhookQueue.add(
      "publish",
      { productId, kind: "publish" },
      { jobId: `update:${productId}` },
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    dev.warn("website webhook enqueue failed (non-fatal)", productId, m);
  }

  dev.log("update complete", productId, `listingId=${listingId}`);

  return { ok: true, skipped: false, listingId };
}
