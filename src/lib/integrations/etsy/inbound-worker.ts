import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import {
  etsyInboundSyncQueue,
  type EtsyInboundSyncJob,
} from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runInboundSync } from "./inbound";

/**
 * BullMQ worker for the `etsy-inbound-sync` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect.
 *
 * Unlike the other Etsy workers (producer = a user action), this one
 * is self-driving: it registers a single repeatable scheduler that
 * fires every 15 minutes. Etsy has no push webhooks, so polling is the
 * only way to pull price/state/sold changes back into the admin.
 *
 * Processor logic lives in `./inbound.ts` so it's unit-testable
 * without a Redis subscription; this file is BullMQ glue + schedule.
 *
 * NOTE: `console.log` is the sanctioned exception in worker files.
 */

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

const log = (...args: unknown[]) => console.log("[etsy-inbound-sync]", ...args);
const err = (...args: unknown[]) =>
  console.error("[etsy-inbound-sync]", ...args);

new Worker<EtsyInboundSyncJob>(
  "etsy-inbound-sync",
  async (job) => {
    log(`started · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({ jobId: job.id, type: "etsy-inbound-sync.started" });

    try {
      const result = await runInboundSync();
      const ms = Date.now() - t0;
      log(
        `completed · ${ms}ms · checked=${result.checked} · ` +
          `updated=${result.updated} · sold=${result.sold}`,
      );
      await logJobEvent({
        jobId: job.id,
        type: "etsy-inbound-sync.completed",
        payload: {
          checked: result.checked,
          updated: result.updated,
          sold: result.sold,
          durationMs: ms,
        },
      });
      return result;
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · ${ms}ms · ${message}`);
      await logJobEvent({
        jobId: job.id,
        type: "etsy-inbound-sync.failed",
        payload: { error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 1 },
);

// Idempotent: re-registering the scheduler with the same id just
// updates its interval, so restarts never stack duplicate timers.
void etsyInboundSyncQueue
  .upsertJobScheduler("etsy-inbound-sync", { every: SYNC_INTERVAL_MS })
  .then(() => log(`scheduler registered · every ${SYNC_INTERVAL_MS}ms`))
  .catch((e) => err("scheduler registration failed", e));

log("registered worker for queue: etsy-inbound-sync");
