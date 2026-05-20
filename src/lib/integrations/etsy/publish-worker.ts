import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import type { EtsyPublishJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runScheduledPublish } from "./publish";

/**
 * BullMQ worker for the `etsy-publish` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect.
 *
 * **Task 9 stub.** The processor logic lives in `./publish.ts`
 * (`runScheduledPublish`) so it can be unit-tested without a Redis
 * subscription. This file is just the BullMQ glue: lifecycle
 * events, console logging for live tail, structured event-log
 * writes for the activity feed.
 *
 * Phase 4c replaces `runScheduledPublish` (real Etsy push + inline
 * translations) but leaves this worker file untouched.
 *
 * NOTE: `console.log` is the sanctioned exception in worker files.
 */

const log = (...args: unknown[]) => console.log("[etsy-publish]", ...args);
const err = (...args: unknown[]) => console.error("[etsy-publish]", ...args);

new Worker<EtsyPublishJob>(
  "etsy-publish",
  async (job) => {
    const productId = job.data.productId;
    log(`started · product=${productId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "etsy-publish.started",
      productId,
    });

    try {
      const result = await runScheduledPublish(productId);
      const ms = Date.now() - t0;

      if (result.skipped) {
        log(`skipped · product=${productId} · reason=${result.reason}`);
        await logJobEvent({
          jobId: job.id,
          type: "etsy-publish.skipped",
          productId,
          payload: { reason: result.reason, durationMs: ms },
        });
      } else {
        log(`completed · product=${productId} · ${ms}ms`);
        await logJobEvent({
          jobId: job.id,
          type: "etsy-publish.completed",
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
        type: "etsy-publish.failed",
        productId,
        payload: { error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 2 },
);

log("registered worker for queue: etsy-publish");
