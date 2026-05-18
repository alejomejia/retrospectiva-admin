import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { logJobEvent } from "@/lib/queue/events-log";
import type { EtsyPublishJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

/**
 * BullMQ worker for the `etsy-publish` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect.
 *
 * **Task 9 stub.** Fires when a scheduled-publish delayed job
 * reaches its target time and flips `products.status` to
 * `published`. The real Etsy push — createDraftListing, upload
 * images + video, inline `runTranslation` per field, then
 * `updateListing(state="active")` — lands in Phase 4c and replaces
 * this processor wholesale.
 *
 * **Race-safety.** Re-reads the row before publishing and skips if
 * the status is no longer `scheduled`. This covers the very narrow
 * window where the user clicks "Cancelar programación" at the same
 * moment BullMQ flips the job to active (so `queue.remove(jobId)`
 * throws "job is active" and the cancel call swallows the error —
 * see the comment in `cancelSchedule`). The active job then arrives
 * here, sees status='draft', and self-cancels.
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
      const [row] = await db
        .select({ status: products.status })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!row) {
        log(`skipped · product=${productId} · row missing`);
        await logJobEvent({
          jobId: job.id,
          type: "etsy-publish.skipped",
          productId,
          payload: { reason: "missing" },
        });
        return { ok: true, skipped: true };
      }
      if (row.status !== "scheduled") {
        log(
          `skipped · product=${productId} · status=${row.status} (race with cancel)`,
        );
        await logJobEvent({
          jobId: job.id,
          type: "etsy-publish.skipped",
          productId,
          payload: { reason: "status", status: row.status },
        });
        return { ok: true, skipped: true };
      }

      // TODO(phase-4c): replace this stub with the real Etsy push.
      //   1. Translate ES → EN inline per TRANSLATABLE_FIELDS.
      //   2. createDraftListing(...) with translated fields.
      //   3. Upload images + video.
      //   4. updateListing(state="active") + persist etsyListingId.
      // For now we just flip the local status so the scheduling
      // round-trip is verifiable end-to-end without OpenAI / Etsy
      // traffic.
      await db
        .update(products)
        .set({ status: "published", updatedAt: sql`now()` })
        .where(eq(products.id, productId));

      const ms = Date.now() - t0;
      log(`completed · product=${productId} · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "etsy-publish.completed",
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
