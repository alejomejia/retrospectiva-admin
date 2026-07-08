"use server";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, productVideos, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import { R2_BUCKET, r2 } from "@/lib/integrations/r2/client";
import {
  generateRawVideoKey,
  generateVideoPosterKey,
  type AllowedVideoExtension,
} from "@/lib/integrations/r2/keys";
import { presignPutUrl } from "@/lib/integrations/r2/presign";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { videoTranscodeQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import {
  VIDEO_MAX_DURATION_MS,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_SOURCE_MAX_BYTES,
  VIDEO_SOURCE_MAX_MB,
} from "./media-limits";

const dev = devGroup("videos");
const EXT_FOR_MIME: Record<string, AllowedVideoExtension> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type CreateVideoUploadInput = {
  productId: string;
  /** Source clip mime — one of the keys of `EXT_FOR_MIME`. */
  contentType: string;
  /** Raw source size in bytes, for the size-cap pre-check. */
  sizeBytes: number;
  /** Browser-extracted WebP poster. May be null if decode failed. */
  poster: File | null;
  /** From `extractVideoPoster`. Null if unreadable. */
  durationMs?: number | null;
};

export type CreateVideoUploadResult =
  | {
      ok: true;
      /** `product_videos.id` of the new `processing` row. */
      videoId: string;
      /** Presigned R2 PUT URL — the browser uploads the raw clip here. */
      uploadUrl: string;
      /** The exact `Content-Type` the PUT must send (bound into the URL). */
      contentType: string;
    }
  | { ok: false; error: string };

/**
 * Step 1 of the two-phase video upload. Validates the clip's declared
 * type/size/duration, uploads the (small) poster, inserts a `processing`
 * `product_videos` row, and returns a presigned R2 PUT URL the browser
 * uses to upload the RAW clip DIRECTLY to R2.
 *
 * The big payload never transits the app server — that's the whole point:
 * a 100 MB+ clip can't buffer in (and OOM) the Next.js process. The
 * transcode runs later in the worker (`transcode-worker.ts`), triggered by
 * `finalizeVideoUpload` once the PUT completes.
 */
export async function createVideoUpload(
  input: CreateVideoUploadInput,
): Promise<CreateVideoUploadResult> {
  const session = await requireSession();
  const { productId, contentType, sizeBytes, poster, durationMs } = input;

  if (sizeBytes > VIDEO_SOURCE_MAX_BYTES) {
    return {
      ok: false,
      error: m.errors.videoTooLarge(
        (sizeBytes / 1024 / 1024).toFixed(1),
        VIDEO_SOURCE_MAX_MB,
      ),
    };
  }
  if (
    durationMs !== undefined &&
    durationMs !== null &&
    durationMs > VIDEO_MAX_DURATION_MS
  ) {
    return {
      ok: false,
      error: m.errors.videoTooLong(
        (durationMs / 1000).toFixed(1),
        VIDEO_MAX_DURATION_SECONDS,
      ),
    };
  }
  const ext = EXT_FOR_MIME[contentType];
  if (!ext) {
    return { ok: false, error: m.errors.unsupportedVideoType(contentType) };
  }

  // Guard against a stale tab posting to a deleted product. Also pull
  // createdAt to date-partition the R2 keys (same browseability
  // rationale as images-actions.ts).
  const [product] = await db
    .select({ id: products.id, createdAt: products.createdAt })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return { ok: false, error: m.errors.productNotFound };

  const uuid = randomUUID();
  const rawKey = generateRawVideoKey({
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

  // The poster is a tiny browser-extracted WebP, so it's safe to push
  // through the action; only the big raw clip goes direct-to-R2.
  if (poster && posterKey) {
    try {
      const posterBuffer = Buffer.from(await poster.arrayBuffer());
      await uploadToR2({
        key: posterKey,
        body: posterBuffer,
        contentType: "image/webp",
      });
    } catch (err) {
      dev.error("poster upload failed:", err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : m.errors.couldNotUploadR2,
      };
    }
  }

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
      status: "processing",
      rawR2Key: rawKey,
      posterR2Key: posterKey,
      durationMs: durationMs ?? null,
      order: nextOrder,
    })
    .returning({ id: productVideos.id });

  if (!row) {
    return { ok: false, error: m.errors.couldNotRecordVideo };
  }

  const uploadUrl = await presignPutUrl({ key: rawKey, contentType });

  await db.insert(events).values({
    productId,
    actor: session.username,
    type: "video.upload_started",
    payloadJson: {
      videoId: row.id,
      rawKey,
      posterKey,
      sourceSizeBytes: sizeBytes,
      durationMs: durationMs ?? null,
    },
  });

  dev.log("upload created:", rawKey, "order=", nextOrder);
  return { ok: true, videoId: row.id, uploadUrl, contentType };
}

/**
 * Step 2 of the two-phase upload. The browser calls this once the raw
 * clip has finished uploading to R2. Enqueues the transcode job (jobId =
 * videoId so a retry coalesces) and revalidates the page so the new
 * `processing` tile renders. The worker takes it from here.
 */
export async function finalizeVideoUpload(
  videoId: string,
): Promise<VideoMutationResult> {
  await requireSession();

  const [row] = await db
    .select({ id: productVideos.id, productId: productVideos.productId, status: productVideos.status })
    .from(productVideos)
    .where(eq(productVideos.id, videoId))
    .limit(1);
  if (!row) return { ok: false, error: m.errors.videoNotFound };

  // Only a freshly-created row should be queued. A non-`processing` status
  // means this was already finalized (double-submit) — treat as success.
  if (row.status === "processing") {
    await videoTranscodeQueue.add(
      "transcode",
      { videoId },
      { jobId: videoId },
    );
    dev.log("transcode queued:", videoId);
  }

  revalidatePath(`/products/${row.productId}`);
  return { ok: true };
}

/**
 * All videos for a product, INCLUDING `processing` and `failed` rows.
 * Used by the admin product page so the operator sees in-flight and
 * failed uploads. Playback/publish surfaces want `listReadyProductVideos`
 * instead — a `processing` row has no `r2Key` yet.
 */
export async function listProductVideos(productId: string) {
  await requireSession();
  return db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .orderBy(asc(productVideos.order));
}

/**
 * Only `ready` videos — those with a transcoded MP4 at `r2Key`. Every
 * surface that actually plays, composes, or publishes a video (socials,
 * Etsy, the storefront payload) uses this so it never touches a row whose
 * transcode is still running or failed.
 */
export async function listReadyProductVideos(productId: string) {
  await requireSession();
  return db
    .select()
    .from(productVideos)
    .where(
      and(
        eq(productVideos.productId, productId),
        eq(productVideos.status, "ready"),
      ),
    )
    .orderBy(asc(productVideos.order));
}

export type VideoMutationResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a video row + its R2 object(s) — the transcoded video, the
 * poster, and the raw source if a transcode never completed (a `failed`
 * or still-`processing` row that the operator removes).
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

  // Delete every object, best-effort. An orphan in R2 is recoverable;
  // an orphan DB row pointing at a missing key is what we want to avoid.
  for (const key of [row.r2Key, row.posterR2Key, row.rawR2Key]) {
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
