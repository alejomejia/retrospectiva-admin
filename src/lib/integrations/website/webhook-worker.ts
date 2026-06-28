import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { logJobEvent } from "@/lib/queue/events-log";
import type { WebsiteWebhookJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { sendWebsiteWebhook } from "./client";
import { buildWebsitePayload } from "./payload-mapper";

/**
 * BullMQ worker for the `website-webhook` queue (Phase 7).
 *
 * Reads the product row, builds the bilingual payload, freezes it into
 * `products.website_snapshot` (the public catalog API serves THAT, not
 * the live columns — so autosaved edits never reach the storefront
 * until an explicit action re-fires a webhook), then posts it signed to
 * `WEBSITE_WEBHOOK_URL`. Failures throw — BullMQ retries per
 * `DEFAULT_JOB_OPTIONS` (3 attempts, exponential backoff).
 *
 * Order matters: the snapshot is persisted BEFORE the POST. The POST is
 * only a cache-bust signal; once the website re-pulls the catalog it
 * must already see the fresh snapshot. A POST failure (retried) leaves
 * the snapshot updated but the website serving its cached copy — safe.
 *
 * Event types written to `events`:
 *   - `website_webhook.started`
 *   - `website_webhook.completed`
 *   - `website_webhook.failed`
 *
 * NOTE: `console.log` is the sanctioned exception in worker files.
 */

const log = (...args: unknown[]) => console.log("[website-webhook]", ...args);
const err = (...args: unknown[]) => console.error("[website-webhook]", ...args);

new Worker<WebsiteWebhookJob>(
  "website-webhook",
  async (job) => {
    const { productId, kind } = job.data;
    log(`started · product=${productId} · kind=${kind} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "website_webhook.started",
      productId,
      payload: { kind },
    });

    try {
      const payload = await buildWebsitePayload({ productId, kind });
      await db
        .update(products)
        .set({ websiteSnapshot: payload })
        .where(eq(products.id, productId));
      const result = await sendWebsiteWebhook(payload);
      const ms = Date.now() - t0;
      log(`completed · product=${productId} · kind=${kind} · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "website_webhook.completed",
        productId,
        payload: {
          kind,
          status: result.status,
          durationMs: ms,
        },
      });
      return { ok: true as const, status: result.status };
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · product=${productId} · ${ms}ms · ${message}`);
      await logJobEvent({
        jobId: job.id,
        type: "website_webhook.failed",
        productId,
        payload: { kind, error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 4 },
);

log("registered worker for queue: website-webhook");
