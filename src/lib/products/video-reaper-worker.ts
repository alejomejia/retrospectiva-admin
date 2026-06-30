import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Worker } from "bullmq";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { events, productVideos } from "@/lib/db/schema";
import { R2_BUCKET, r2 } from "@/lib/integrations/r2/client";
import { logJobEvent } from "@/lib/queue/events-log";
import { videoReaperQueue, type VideoReaperJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

/**
 * BullMQ worker for the `video-reaper` queue. Imported by
 * `src/lib/queue/worker.ts` as a side effect; registers a repeatable job
 * (every {@link SWEEP_EVERY_MS}) and processes it.
 *
 * Purpose: clean up `processing` `product_videos` rows that no transcode
 * will ever finish — almost always an upload whose browser PUT to R2
 * succeeded but never reached `finalizeVideoUpload` (tab closed), so no
 * job was ever queued. Such a row + its raw R2 object would otherwise sit
 * forever. See `enrich-worker.ts` for the `console.log` exception in
 * worker files.
 */

const log = (...args: unknown[]) => console.log("[video-reaper]", ...args);
const err = (...args: unknown[]) => console.error("[video-reaper]", ...args);

/**
 * Grace period before a still-`processing` row is treated as abandoned.
 * Transcodes finish in seconds (minutes across BullMQ's 3 retries), so an
 * hour is far longer than any legitimate in-flight job — only uploads
 * whose finalize never fired get reaped.
 */
const ABANDON_AFTER_MS = 60 * 60 * 1000;

/** How often the reaper sweeps. */
const SWEEP_EVERY_MS = 30 * 60 * 1000;

/** Stable scheduler id so re-registering on each boot is idempotent. */
const SCHEDULER_ID = "video-reaper-sweep";

/**
 * Deletes every `processing` row older than {@link ABANDON_AFTER_MS} along
 * with its R2 objects (raw source, poster, and any partial output).
 * Best-effort on R2 — an orphaned object is recoverable; the goal is to
 * not leave a dangling DB row. Returns how many rows were reaped.
 */
async function reapAbandonedVideos(): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);
  const rows = await db
    .select()
    .from(productVideos)
    .where(
      and(
        eq(productVideos.status, "processing"),
        lt(productVideos.updatedAt, cutoff),
      ),
    );

  for (const row of rows) {
    for (const key of [row.rawR2Key, row.posterR2Key, row.r2Key]) {
      if (!key) continue;
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      } catch (e) {
        err("R2 delete failed (continuing):", key, e);
      }
    }
    await db.delete(productVideos).where(eq(productVideos.id, row.id));
    await db.insert(events).values({
      productId: row.productId,
      actor: "worker",
      type: "video.reaped",
      payloadJson: { videoId: row.id, rawKey: row.rawR2Key },
    });
  }

  return rows.length;
}

new Worker<VideoReaperJob>(
  "video-reaper",
  async (job) => {
    const t0 = Date.now();
    const reaped = await reapAbandonedVideos();
    const ms = Date.now() - t0;
    if (reaped > 0) {
      log(`reaped ${reaped} abandoned upload(s) · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "video-reaper.swept",
        payload: { reaped, durationMs: ms },
      });
    }
    return { ok: true, reaped };
  },
  { connection: redis, concurrency: 1 },
);

// Idempotent: re-upserting the same scheduler id on every boot just keeps
// the single repeatable job in place (BullMQ persists it in Redis, so it
// survives restarts and only fires once cluster-wide per interval).
void videoReaperQueue.upsertJobScheduler(
  SCHEDULER_ID,
  { every: SWEEP_EVERY_MS },
  { name: "sweep" },
);

log("registered worker for queue: video-reaper");
