import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import type { EtsyUpdateJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runEtsyListingUpdate } from "./update";

/**
 * BullMQ worker for the `etsy-update` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect.
 *
 * Mirrors `publish-worker.ts` — processor logic lives in
 * `./update.ts` so it can be unit-tested without a Redis
 * subscription. This file is just the BullMQ glue.
 *
 * NOTE: `console.log` is the sanctioned exception in worker files.
 */

const log = (...args: unknown[]) => console.log("[etsy-update]", ...args);
const err = (...args: unknown[]) => console.error("[etsy-update]", ...args);

new Worker<EtsyUpdateJob>(
  "etsy-update",
  async (job) => {
    const productId = job.data.productId;
    log(`started · product=${productId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "etsy-update.started",
      productId,
    });

    try {
      const result = await runEtsyListingUpdate(productId);
      const ms = Date.now() - t0;

      if (result.skipped) {
        log(`skipped · product=${productId} · reason=${result.reason}`);
        await logJobEvent({
          jobId: job.id,
          type: "etsy-update.skipped",
          productId,
          payload: { reason: result.reason, durationMs: ms },
        });
      } else {
        log(`completed · product=${productId} · ${ms}ms`);
        await logJobEvent({
          jobId: job.id,
          type: "etsy-update.completed",
          productId,
          payload: { durationMs: ms },
        });
      }
      return result;
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · product=${productId} · ${ms}ms · ${message}`);
      await logJobEvent({
        jobId: job.id,
        type: "etsy-update.failed",
        productId,
        payload: { error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 2 },
);

log("registered worker for queue: etsy-update");
