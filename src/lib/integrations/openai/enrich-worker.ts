import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import type { AiEnrichJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runEnrichment } from "./enrich";

/**
 * BullMQ worker for the `ai-enrich` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect; subscribes to Redis
 * and processes jobs.
 *
 * NOTE: `console.log` is the sanctioned exception in worker files
 * (see `src/lib/queue/worker.ts` for the rationale). Workers are
 * long-running daemons; `devLog` no-ops in production, which would
 * make the container silent exactly when ops needs to see what's
 * happening. `logJobEvent` writes to the DB for the activity feed;
 * the console lines below are for live tail visibility.
 */

const log = (...args: unknown[]) => console.log("[ai-enrich]", ...args);
const err = (...args: unknown[]) => console.error("[ai-enrich]", ...args);

new Worker<AiEnrichJob>(
  "ai-enrich",
  async (job) => {
    const productId = job.data.productId;
    log(`started · product=${productId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "ai-enrich.started",
      productId,
    });
    try {
      await runEnrichment(productId);
      const ms = Date.now() - t0;
      log(`completed · product=${productId} · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "ai-enrich.completed",
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
        type: "ai-enrich.failed",
        productId,
        payload: { error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 2 },
);

log("registered worker for queue: ai-enrich");
