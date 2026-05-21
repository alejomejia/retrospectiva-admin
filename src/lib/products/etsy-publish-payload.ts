import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { productImages } from "@/lib/db/schema";

/**
 * Builder for the image payload the Etsy publish worker will upload
 * for a listing (Phase 4c, Task 9). Kept in its own module — not in
 * `images-actions.ts` — because that file uses `"use server"` and
 * therefore can only export async functions; the constants + types
 * here would break at module-eval if co-located.
 *
 * No `requireSession` here: this runs from the BullMQ worker
 * context, not a request. Auth gating happens at the action layer
 * that enqueues the publish job (`scheduleProduct` / future
 * on-demand publish).
 */

/**
 * Etsy hard-caps the listing photo set at 10 images. Originals
 * already obey this at upload time via the client uploader; the
 * publish builder cuts the appended `ai_model` if adding it would
 * push the listing over the limit. Source: Etsy Open API v3
 * `createListingImage` docs.
 */
export const ETSY_LISTING_MAX_IMAGES = 10;

/** Single image entry the publish worker will upload to Etsy. */
export type PublishImage = {
  r2Key: string;
  role: "original" | "ai_model";
  width: number | null;
  height: number | null;
};

/**
 * Returns the ordered image set the Etsy publish worker will upload
 * for `productId`. Originals come first in their stored `order`;
 * the single `ai_model` image (if present) is appended at the end
 * so `originals[0]` stays the listing cover — the customer's first
 * impression remains a real photo, the AI shot is a polished
 * showcase further down. `ai_reference` is excluded (input-only)
 * and `thumbnail` is excluded too (publish builder doesn't need it).
 *
 * Respects {@link ETSY_LISTING_MAX_IMAGES}: when adding the AI
 * image would push past the cap, the cap wins and the AI image is
 * dropped. Originals are the source of truth — the operator can
 * delete one to make room for the AI shot.
 */
export async function listImagesForEtsyPublish(
  productId: string,
): Promise<PublishImage[]> {
  const rows = await db
    .select({
      r2Key: productImages.r2Key,
      role: productImages.role,
      order: productImages.order,
      width: productImages.width,
      height: productImages.height,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  const originals = rows
    .filter((r) => r.role === "original")
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      r2Key: r.r2Key,
      role: "original" as const,
      width: r.width,
      height: r.height,
    }));

  const aiModel = rows.find((r) => r.role === "ai_model") ?? null;

  const out: PublishImage[] = [...originals];
  if (aiModel && out.length < ETSY_LISTING_MAX_IMAGES) {
    out.push({
      r2Key: aiModel.r2Key,
      role: "ai_model",
      width: aiModel.width,
      height: aiModel.height,
    });
  }
  return out.slice(0, ETSY_LISTING_MAX_IMAGES);
}
