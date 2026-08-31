#!/usr/bin/env tsx

/**
 * One-shot re-emit of the public website snapshot for already-published
 * products. Pairs with `backfill-website-titles`.
 *
 * WHY THIS IS NEEDED: the public catalog API serves the frozen
 * `products.website_snapshot` blob, NOT the live columns (see
 * `website/webhook-worker.ts`). Direct DB writes — like the website-title
 * backfill — update the columns but leave the snapshot (and the website's
 * indefinitely-cached copy) stale. The snapshot only rebuilds when a
 * `website-webhook` job runs. This script enqueues one `update` job per
 * live product, exactly like the UI's "Update website" action
 * (`updatePublishedProduct` → `notifyWebsite(id, "update")`), so the
 * running `website-webhook` worker rebuilds each snapshot from the current
 * columns (picking up `website_title_*`) and busts the storefront cache.
 *
 * SCOPE: only rows with a non-null `website_snapshot` — i.e. products that
 * have been emitted at least once and are what the storefront actually
 * serves. Drafts have no snapshot; they build a fresh one (with the new
 * website title) on first publish, so they need nothing here.
 *
 * This only ENQUEUES jobs — the `website-webhook` worker must be running to
 * process them (it is, in the worker container). No OpenAI calls: the
 * backfill already populated `website_title_es`; the worker just rebuilds
 * the payload from existing columns. Needs REDIS_URL + DATABASE_URL.
 *
 * Idempotent: the webhook rebuilds its payload from current state and each
 * enqueue uses an auto-generated jobId, so re-running is safe (it just
 * re-pushes the same snapshot). Pass `--dry-run` to preview counts,
 * `--limit=N` to cap the batch.
 *
 * Usage (local):
 *   pnpm reemit:website-snapshots              # enqueue for all live rows
 *   pnpm reemit:website-snapshots --dry-run    # preview only
 *   pnpm reemit:website-snapshots --limit=20   # first 20 rows
 *
 * On the VPS (inside the worker/app container, which has REDIS_URL +
 * DATABASE_URL):
 *   node_modules/.bin/tsx scripts/reemit-website-snapshots.ts --dry-run
 */
import "@/lib/queue/env-bootstrap";

import { isNotNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { websiteWebhookQueue } from "@/lib/queue/queues";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  // Only products the storefront actually serves have a snapshot to
  // refresh; drafts (snapshot null) get a fresh one on first publish.
  const rows = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(isNotNull(products.websiteSnapshot));

  const batch = limit != null ? rows.slice(0, limit) : rows;
  console.log(
    `[reemit] ${rows.length} live products have a snapshot` +
      (limit != null ? ` — enqueuing first ${batch.length}` : ""),
  );

  if (batch.length === 0) {
    console.log("[reemit] nothing to do.");
    return;
  }
  if (dryRun) {
    console.log("[reemit] --dry-run: no jobs enqueued.");
    return;
  }

  let enqueued = 0;
  let failed = 0;
  for (const row of batch) {
    try {
      // `update` kind mirrors the UI's "Update website" action: the worker
      // rebuilds the snapshot from current columns and busts the cache. The
      // product's real status is preserved in the rebuilt payload.
      await websiteWebhookQueue.add("update", {
        productId: row.id,
        kind: "update",
      });
      enqueued++;
      console.log(`[reemit] ${row.id}  (${row.status})`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[reemit] FAILED ${row.id}: ${msg}`);
    }
  }

  console.log(
    `[reemit] done — ${enqueued} enqueued, ${failed} failed. The ` +
      `website-webhook worker will rebuild each snapshot and bust the ` +
      `storefront cache.`,
  );

  await websiteWebhookQueue.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[reemit] failed:", err);
    process.exit(1);
  });
