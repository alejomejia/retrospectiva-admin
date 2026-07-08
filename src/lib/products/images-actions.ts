"use server";

import { randomUUID } from "node:crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, productImages, products } from "@/lib/db/schema";
import { R2_BUCKET, r2 } from "@/lib/integrations/r2/client";
import {
  generateImageKey,
  type AllowedExtension,
} from "@/lib/integrations/r2/keys";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { m } from "@/lib/i18n/messages.en";
import { devGroup } from "@/lib/utils/dev";

import { IMAGE_MAX_BYTES, IMAGE_MAX_MB } from "./media-limits";

const dev = devGroup("images");
const EXT_FOR_MIME: Record<string, AllowedExtension> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

export type UploadImageInput = {
  productId: string;
  file: File;
  width?: number;
  height?: number;
};

export type UploadImageResult =
  | { ok: true; id: string; key: string }
  | { ok: false; error: string };

/**
 * Uploads a single (already-compressed-on-the-client) image to R2 and
 * inserts a `product_images` row. The order is the current max+1, so
 * new uploads stack on the end of the list.
 */
export async function uploadProductImage(
  input: UploadImageInput,
): Promise<UploadImageResult> {
  const session = await requireSession();
  const { productId, file, width, height } = input;

  if (file.size > IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: m.errors.imageTooLarge(
        (file.size / 1024 / 1024).toFixed(1),
        IMAGE_MAX_MB,
      ),
    };
  }
  const ext = EXT_FOR_MIME[file.type];
  if (!ext) {
    return {
      ok: false,
      error: m.errors.unsupportedImageType(file.type),
    };
  }

  // Make sure the product exists; cheap protection against a stale tab
  // POSTing to a deleted product id. We also pull `createdAt` to
  // partition the R2 key by the product's creation date — keeps the
  // bucket browseable by year/month/day in the R2 console.
  const [product] = await db
    .select({ id: products.id, createdAt: products.createdAt })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return { ok: false, error: m.errors.productNotFound };

  const key = generateImageKey({
    productId,
    createdAt: product.createdAt,
    role: "original",
    uuid: randomUUID(),
    extension: ext,
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2({ key, body: buffer, contentType: file.type });
  } catch (err) {
    dev.error("uploadToR2 failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : m.errors.couldNotUploadR2,
    };
  }

  // Next order = current max + 1. Race-safe enough for a 2-user admin;
  // tighten with a transaction if we ever have concurrent uploads.
  const existing = await db
    .select({ order: productImages.order })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "original"),
      ),
    )
    .orderBy(asc(productImages.order));
  const nextOrder =
    existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.order)) + 1;

  const [row] = await db
    .insert(productImages)
    .values({
      productId,
      r2Key: key,
      role: "original",
      order: nextOrder,
      width: width ?? null,
      height: height ?? null,
    })
    .returning({ id: productImages.id });

  if (!row) {
    // R2 succeeded but DB insert didn't — the orphan key in R2 can be
    // swept manually via the admin's per-image trash (or the
    // `deleteR2Prefix` helper if a whole product needs hard-deleting).
    return { ok: false, error: m.errors.couldNotRecordImage };
  }

  await db.insert(events).values({
    productId,
    actor: session.username,
    type: "image.uploaded",
    payloadJson: { imageId: row.id, key, order: nextOrder },
  });

  dev.log("uploaded:", key, "order=", nextOrder);
  revalidatePath(`/products/${productId}`);
  return { ok: true, id: row.id, key };
}

/**
 * Lists images for a product, ordered. The detail page renders these.
 */
export async function listProductImages(productId: string) {
  await requireSession();
  return db
    .select()
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "original"),
      ),
    )
    .orderBy(asc(productImages.order));
}


export type ImageMutationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deletes a single image row + its R2 object. We delete the R2 object
 * directly (not via the prefix sweeper) so other images for the same
 * product stay intact.
 */
export async function deleteProductImage(
  imageId: string,
): Promise<ImageMutationResult> {
  const session = await requireSession();
  const [row] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1);
  if (!row) return { ok: false, error: m.errors.imageNotFound };

  try {
    // Single-object delete — `deleteR2Prefix` is for sweeping a whole
    // product's tree on sale, not a single image swap.
    await r2.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.r2Key }),
    );
  } catch (err) {
    // Best-effort: an orphan in R2 is recoverable (sale-time cleanup
    // will sweep it), an orphan DB row pointing at a missing object is
    // not. Log and proceed with the DB delete.
    dev.error("R2 delete failed (DB row will still be removed):", err);
  }

  await db.delete(productImages).where(eq(productImages.id, imageId));
  await db.insert(events).values({
    productId: row.productId,
    actor: session.username,
    type: "image.deleted",
    payloadJson: { imageId, key: row.r2Key },
  });

  dev.log("deleted:", row.r2Key);
  revalidatePath(`/products/${row.productId}`);
  return { ok: true };
}

/**
 * Move an image one slot up/down in the display order. We swap `order`
 * with the neighbor rather than recomputing the full list — keeps the
 * write small and stable across concurrent edits.
 */
export async function moveProductImage(
  imageId: string,
  direction: "up" | "down",
): Promise<ImageMutationResult> {
  await requireSession();

  const [target] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1);
  if (!target) return { ok: false, error: m.errors.imageNotFound };

  const siblings = await db
    .select()
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, target.productId),
        eq(productImages.role, target.role),
      ),
    )
    .orderBy(asc(productImages.order));

  const idx = siblings.findIndex((s) => s.id === imageId);
  const swapWith = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) {
    // Already at the edge — silent no-op rather than an error.
    return { ok: true };
  }

  // Two single-row updates rather than a transaction; in a 2-user app
  // the worst case is a brief inconsistency window.
  await db
    .update(productImages)
    .set({ order: swapWith.order })
    .where(eq(productImages.id, target.id));
  await db
    .update(productImages)
    .set({ order: target.order })
    .where(eq(productImages.id, swapWith.id));

  revalidatePath(`/products/${target.productId}`);
  return { ok: true };
}

/**
 * Batch-reorder images by setting `order` to match the position in the
 * provided `imageIds` array. All IDs must belong to the same product
 * and role.
 */
export async function reorderProductImages(
  imageIds: string[],
): Promise<ImageMutationResult> {
  await requireSession();
  if (imageIds.length === 0) return { ok: true };

  const [first] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageIds[0]))
    .limit(1);
  if (!first) return { ok: false, error: m.errors.imageNotFound };

  for (let i = 0; i < imageIds.length; i++) {
    await db
      .update(productImages)
      .set({ order: i })
      .where(eq(productImages.id, imageIds[i]));
  }

  revalidatePath(`/products/${first.productId}`);
  return { ok: true };
}

/**
 * Promote an image to the primary slot (order=0) and shift everything
 * else down by one.
 */
export async function setPrimaryProductImage(
  imageId: string,
): Promise<ImageMutationResult> {
  await requireSession();

  const [target] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1);
  if (!target) return { ok: false, error: m.errors.imageNotFound };
  if (target.order === 0) return { ok: true }; // already primary

  const siblings = await db
    .select()
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, target.productId),
        eq(productImages.role, target.role),
      ),
    )
    .orderBy(asc(productImages.order));

  // Re-number sequentially: target first, everyone else stays in order.
  let order = 0;
  await db
    .update(productImages)
    .set({ order })
    .where(eq(productImages.id, target.id));
  order = 1;
  for (const s of siblings) {
    if (s.id === target.id) continue;
    await db
      .update(productImages)
      .set({ order })
      .where(eq(productImages.id, s.id));
    order += 1;
  }

  revalidatePath(`/products/${target.productId}`);
  return { ok: true };
}
