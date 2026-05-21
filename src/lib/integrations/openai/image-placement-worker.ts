import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import type { AiImagePlacementJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runImagePlacement } from "./image-placement";

/**
 * BullMQ worker for the `ai-image-placement` queue (Task 11).
 * Imported by `src/lib/queue/worker.ts` as a side effect; subscribes
 * to Redis and processes one job per product.
 *
 * See `enrich-worker.ts` for the rationale on the `console.log`
 * exception in worker files.
 */

const log = (...args: unknown[]) =>
  console.log("[ai-image-placement]", ...args);
const err = (...args: unknown[]) =>
  console.error("[ai-image-placement]", ...args);

new Worker<AiImagePlacementJob>(
  "ai-image-placement",
  async (job) => {
    const productId = job.data.productId;
    log(`started · product=${productId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "ai-image-placement.started",
      productId,
    });
    try {
      await runImagePlacement(productId);
      const ms = Date.now() - t0;
      log(`completed · product=${productId} · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "ai-image-placement.completed",
        productId,
        payload: { durationMs: ms },
      });
      return { ok: true };
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · product=${productId} · ${ms}ms · ${message}`);
      await logJobEvent({
        jobId: job.id,
        type: "ai-image-placement.failed",
        productId,
        payload: { error: message, durationMs: ms },
      });
      throw e;
    }
  },
  // Concurrency=1: gpt-image-2 calls are expensive and the volume is
  // human-driven (one click per product). Single-flight is plenty
  // and avoids accidentally fanning out a cost spike if the user
  // mashes Regenerar across many products simultaneously.
  { connection: redis, concurrency: 1 },
);

log("registered worker for queue: ai-image-placement");
