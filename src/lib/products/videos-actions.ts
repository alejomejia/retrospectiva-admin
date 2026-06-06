"use server";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, productVideos, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { R2_BUCKET, r2 } from "@/lib/integrations/r2/client";
import {
  generateVideoKey,
  generateVideoPosterKey,
  type AllowedVideoExtension,
} from "@/lib/integrations/r2/keys";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { devGroup } from "@/lib/utils/dev";

import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_MAX_MB,
} from "./media-limits";

const dev = devGroup("videos");
const EXT_FOR_MIME: Record<string, AllowedVideoExtension> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type UploadVideoInput = {
  productId: string;
  video: File;
  /** Browser-extracted WebP poster. May be null if decode failed. */
  poster: File | null;
  /** From `extractVideoPoster`. Null if unreadable. */
  durationMs?: number | null;
  width?: number;
  height?: number;
};

export type UploadVideoResult =
  | { ok: true; id: string; key: string }
  | { ok: false; error: string };

/**
 * Validates a video upload, pushes the video + (optional) poster to R2,
 * and inserts a `product_videos` row.
 *
 * No transcoding here — for a 2-user shop the storage savings of a
 * WASM/ffmpeg pipeline don't justify the dependency weight or the
 * server CPU spend. Phase 4 will trim/transcode for Etsy if their
 * compatibility ceiling forces our hand.
 */
export async function uploadProductVideo(
  input: UploadVideoInput,
): Promise<UploadVideoResult> {
  const session = await requireSession();
  const { productId, video, poster, durationMs, width, height } = input;

  // Step logging — visible in prod container stdout (devGroup now always
  // logs server-side). Lets us see exactly where a stuck upload dies:
  // if "entry" never prints, the request never reached the action (proxy
  // / body-size / Traefik). If "entry" prints but "r2:video done" doesn't,
  // it's the R2 PUT.
  dev.log(
    "entry: product=",
    productId,
    "type=",
    video.type,
    "videoBytes=",
    video.size,
    "posterBytes=",
    poster?.size ?? null,
    "durationMs=",
    durationMs ?? null,
  );

  if (video.size > VIDEO_MAX_BYTES) {
    return {
      ok: false,
      error: m.errors.videoTooLarge(
        (video.size / 1024 / 1024).toFixed(1),
        VIDEO_MAX_MB,
      ),
    };
  }
  if (durationMs !== undefined && durationMs !== null && durationMs > VIDEO_MAX_DURATION_MS) {
    return {
      ok: false,
      error: m.errors.videoTooLong(
        (durationMs / 1000).toFixed(1),
        VIDEO_MAX_DURATION_SECONDS,
      ),
    };
  }
  const ext = EXT_FOR_MIME[video.type];
  if (!ext) {
    return {
      ok: false,
      error: m.errors.unsupportedVideoType(video.type),
    };
  }

  // Guard against a stale tab posting to a deleted product. Also pull
  // createdAt to date-partition the R2 keys (same browseability
  // rationale as images-actions.ts).
  dev.log("db:product lookup", productId);
  const [product] = await db
    .select({ id: products.id, createdAt: products.createdAt })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  dev.log("db:product lookup done, found=", Boolean(product));
  if (!product) return { ok: false, error: m.errors.productNotFound };

  const uuid = randomUUID();
  const videoKey = generateVideoKey({
    productId,
    createdAt: product.createdAt,
    uuid,
    extension: ext,
  });
  const posterKey = poster
    ? generateVideoPosterKey({
        productId,
        createdAt: product.createdAt,
        uuid,
      })
    : null;

  try {
    dev.log("r2:video buffering", video.size, "bytes →", videoKey);
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    dev.log("r2:video buffered, sending", videoBuffer.byteLength, "bytes");
    await uploadToR2({
      key: videoKey,
      body: videoBuffer,
      contentType: video.type,
    });
    dev.log("r2:video done");

    if (poster && posterKey) {
      const posterBuffer = Buffer.from(await poster.arrayBuffer());
      await uploadToR2({
        key: posterKey,
        body: posterBuffer,
        contentType: "image/webp",
      });
      dev.log("r2:poster done", posterKey);
    }
  } catch (err) {
    dev.error("R2 upload failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : m.errors.couldNotUploadR2,
    };
  }
  dev.log("db:inserting row");

  const existing = await db
    .select({ order: productVideos.order })
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .orderBy(asc(productVideos.order));
  const nextOrder =
    existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.order)) + 1;

  const [row] = await db
    .insert(productVideos)
    .values({
      productId,
      r2Key: videoKey,
      posterR2Key: posterKey,
      mimeType: video.type,
      sizeBytes: video.size,
      durationMs: durationMs ?? null,
      width: width ?? null,
      height: height ?? null,
      order: nextOrder,
    })
    .returning({ id: productVideos.id });

  if (!row) {
    return { ok: false, error: m.errors.couldNotRecordVideo };
  }

  await db.insert(events).values({
    productId,
    actor: session.username,
    type: "video.uploaded",
    payloadJson: {
      videoId: row.id,
      key: videoKey,
      posterKey,
      sizeBytes: video.size,
      durationMs: durationMs ?? null,
    },
  });

  dev.log("uploaded:", videoKey, "order=", nextOrder);
  revalidatePath(`/products/${productId}`);
  return { ok: true, id: row.id, key: videoKey };
}

export async function listProductVideos(productId: string) {
  await requireSession();
  return db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .orderBy(asc(productVideos.order));
}

export type VideoMutationResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a video row + its R2 object(s) — the video file and the
 * poster, if present.
 */
export async function deleteProductVideo(
  videoId: string,
): Promise<VideoMutationResult> {
  const session = await requireSession();
  const [row] = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.id, videoId))
    .limit(1);
  if (!row) return { ok: false, error: m.errors.videoNotFound };

  // Delete both objects, best-effort. An orphan in R2 is recoverable;
  // an orphan DB row pointing at a missing key is what we want to avoid.
  for (const key of [row.r2Key, row.posterR2Key]) {
    if (!key) continue;
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      dev.error("R2 delete failed (continuing):", key, err);
    }
  }

  await db.delete(productVideos).where(eq(productVideos.id, videoId));
  await db.insert(events).values({
    productId: row.productId,
    actor: session.username,
    type: "video.deleted",
    payloadJson: { videoId, key: row.r2Key },
  });

  dev.log("deleted:", row.r2Key);
  revalidatePath(`/products/${row.productId}`);
  return { ok: true };
}

/** Move a video one slot up/down. Mirrors the image-list ordering UX. */
export async function moveProductVideo(
  videoId: string,
  direction: "up" | "down",
): Promise<VideoMutationResult> {
  await requireSession();

  const [target] = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.id, videoId))
    .limit(1);
  if (!target) return { ok: false, error: m.errors.videoNotFound };

  const siblings = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, target.productId))
    .orderBy(asc(productVideos.order));

  const idx = siblings.findIndex((s) => s.id === videoId);
  const swapWith = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
  if (!swapWith) return { ok: true };

  await db
    .update(productVideos)
    .set({ order: swapWith.order })
    .where(eq(productVideos.id, target.id));
  await db
    .update(productVideos)
    .set({ order: target.order })
    .where(eq(productVideos.id, swapWith.id));

  revalidatePath(`/products/${target.productId}`);
  return { ok: true };
}
