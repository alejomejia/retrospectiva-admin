import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { db } from "@/lib/db/client";
import { productVideos } from "@/lib/db/schema";
import { R2_BUCKET, r2 } from "@/lib/integrations/r2/client";
import { downloadR2ObjectToFile } from "@/lib/integrations/r2/fetch";
import { deriveTranscodedVideoKey } from "@/lib/integrations/r2/keys";
import { uploadFileToR2 } from "@/lib/integrations/r2/upload";
import { logJobEvent } from "@/lib/queue/events-log";
import type { VideoTranscodeJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { TRANSCODED_MIME, transcodeVideoFile } from "./transcode-video";

/**
 * BullMQ worker for the `video-transcode` queue. Imported by
 * `src/lib/queue/worker.ts` as a side effect.
 *
 * Per job it: loads the `processing` row, streams the raw R2 object to a
 * temp file, transcodes it to 1080p H.264/MP4 on disk, streams the result
 * back to R2, flips the row to `ready` (with the final key + dimensions +
 * size), and sweeps the raw temp object. Nothing about this touches the
 * app server — which is the entire point: the bytes never transit the
 * Next.js process, so a large clip can't OOM it.
 *
 * On failure the job is rethrown so BullMQ retries (3×); once retries are
 * exhausted the row is marked `failed` with the error so the UI can stop
 * polling and show a message. See `enrich-worker.ts` for the `console.log`
 * exception in worker files.
 */

const log = (...args: unknown[]) => console.log("[video-transcode]", ...args);
const err = (...args: unknown[]) => console.error("[video-transcode]", ...args);

/** Temp-dir prefix for this worker's scratch files. */
const TEMP_PREFIX = "product-video-";

/** Source extension from a raw key, defaulting to `.bin` (ffmpeg sniffs
 *  the container regardless — the name is just a hint). */
function extFromKey(key: string): string {
  const dot = key.lastIndexOf(".");
  return dot === -1 ? "bin" : key.slice(dot + 1);
}

/**
 * Removes scratch dirs left behind by a previous worker that was hard-
 * killed mid-transcode (SIGKILL/OOM) — its job's `finally` never ran. Safe
 * to wipe ALL of them at startup: this runs before any job is picked up,
 * so nothing here is in use. Best-effort; a sweep failure must not stop
 * the worker from coming up.
 */
async function sweepStaleTempDirs(): Promise<void> {
  try {
    const entries = await readdir(tmpdir(), { withFileTypes: true });
    const stale = entries.filter(
      (e) => e.isDirectory() && e.name.startsWith(TEMP_PREFIX),
    );
    await Promise.all(
      stale.map((e) =>
        rm(join(tmpdir(), e.name), { recursive: true, force: true }),
      ),
    );
    if (stale.length > 0) log(`swept ${stale.length} stale temp dir(s)`);
  } catch (e) {
    err("temp sweep failed (continuing):", e);
  }
}

new Worker<VideoTranscodeJob>(
  "video-transcode",
  async (job) => {
    const { videoId } = job.data;
    log(`started · video=${videoId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({ jobId: job.id, type: "video-transcode.started" });

    const [row] = await db
      .select()
      .from(productVideos)
      .where(eq(productVideos.id, videoId))
      .limit(1);

    // Row gone (product deleted, video removed) or already processed —
    // nothing to do. Treat as success so the job doesn't retry forever.
    if (!row || !row.rawR2Key || row.status === "ready") {
      log(`skip · video=${videoId} · status=${row?.status ?? "missing"}`);
      return { ok: true, skipped: true };
    }

    const rawKey = row.rawR2Key;
    const finalKey = deriveTranscodedVideoKey(rawKey);
    const work = await mkdtemp(join(tmpdir(), TEMP_PREFIX));
    const inPath = join(work, `in.${extFromKey(rawKey)}`);
    const outPath = join(work, "out.mp4");

    try {
      await downloadR2ObjectToFile({ key: rawKey, destPath: inPath });
      const { width, height } = await transcodeVideoFile(inPath, outPath);
      const { size: sizeBytes } = await stat(outPath);
      await uploadFileToR2({
        key: finalKey,
        filePath: outPath,
        contentType: TRANSCODED_MIME,
      });

      await db
        .update(productVideos)
        .set({
          status: "ready",
          r2Key: finalKey,
          rawR2Key: null,
          error: null,
          mimeType: TRANSCODED_MIME,
          sizeBytes,
          width,
          height,
          updatedAt: new Date(),
        })
        .where(eq(productVideos.id, videoId));

      // Sweep the raw temp object — best effort. An orphaned raw object is
      // recoverable; a failed delete must not fail an otherwise-done job.
      try {
        await r2.send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: rawKey }),
        );
      } catch (e) {
        err(`raw sweep failed (continuing) · key=${rawKey}`, e);
      }

      const ms = Date.now() - t0;
      log(`completed · video=${videoId} · ${ms}ms · ${sizeBytes}B`);
      await logJobEvent({
        jobId: job.id,
        productId: row.productId,
        type: "video-transcode.completed",
        payload: { videoId, key: finalKey, sizeBytes, durationMs: ms },
      });
      return { ok: true };
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · video=${videoId} · ${ms}ms · ${message}`);

      // Only flip the row to `failed` once BullMQ has exhausted its
      // retries — earlier attempts stay `processing` so a transient blip
      // (R2 hiccup) doesn't surface a scary state the next retry clears.
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        await db
          .update(productVideos)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(productVideos.id, videoId));
      }

      await logJobEvent({
        jobId: job.id,
        productId: row.productId,
        type: "video-transcode.failed",
        payload: { videoId, error: message, durationMs: ms },
      });
      throw e;
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  },
  // Concurrency=1: transcodes are CPU/memory heavy and the volume is
  // human-driven (a few clips per product). Single-flight keeps the small
  // VPS from running two ffmpeg processes at once.
  { connection: redis, concurrency: 1 },
);

// Fire-and-forget: clear any scratch dirs orphaned by a prior hard kill.
void sweepStaleTempDirs();

log("registered worker for queue: video-transcode");
