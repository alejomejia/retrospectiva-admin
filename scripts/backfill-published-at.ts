#!/usr/bin/env tsx

/**
 * One-shot, idempotent backfill for `products.published_at`.
 *
 * `published_at` is the frozen first-publish timestamp that drives the
 * storefront NEW badge + shop ordering (see `payload-mapper` /
 * `website/catalog`). New publishes stamp it via the publish worker, but
 * products published BEFORE the column existed have it null — which makes
 * them fall back to `created_at`, so they sort by creation date and never
 * show as "new". This script populates it for every already-published row:
 *
 *   1. From the events log — the earliest `etsy-publish.completed` event
 *      per product is its true first-publish time.
 *   2. Fallback — any published/sold/archived row with no such event
 *      (manual reconcile, or pruned events) anchors to `created_at`.
 *
 * Idempotent: only ever writes rows where `published_at IS NULL`, so it is
 * safe to re-run. Pass `--dry-run` to print the counts without writing.
 *
 * Usage (local):
 *   pnpm backfill:published-at            # apply
 *   pnpm backfill:published-at --dry-run  # preview only
 *
 * On the VPS (inside the app/worker container, which has DATABASE_URL):
 *   docker compose exec app pnpm backfill:published-at
 */
import "@/lib/queue/env-bootstrap";

import { and, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

const VISIBLE_OR_ARCHIVED = ["published", "sold", "archived"] as const;

async function countNullPublishedAt(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        isNull(products.publishedAt),
        inArray(products.status, [...VISIBLE_OR_ARCHIVED]),
      ),
    );
  return row?.n ?? 0;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const before = await countNullPublishedAt();
  console.log(
    `[backfill] ${before} published/sold/archived rows have a null published_at`,
  );

  if (before === 0) {
    console.log("[backfill] nothing to do — already fully populated.");
    return;
  }

  if (dryRun) {
    console.log("[backfill] --dry-run: no changes written.");
    return;
  }

  // 1. True first-publish time from the events log.
  await db.execute(sql`
    UPDATE ${products} AS p
    SET published_at = sub.first_publish
    FROM (
      SELECT product_id, MIN(created_at) AS first_publish
      FROM events
      WHERE type = 'etsy-publish.completed' AND product_id IS NOT NULL
      GROUP BY product_id
    ) AS sub
    WHERE p.id = sub.product_id AND p.published_at IS NULL
  `);

  // 2. Fallback: published/sold/archived rows with no publish event.
  await db.execute(sql`
    UPDATE ${products}
    SET published_at = created_at
    WHERE published_at IS NULL
      AND status IN ('published', 'sold', 'archived')
  `);

  const after = await countNullPublishedAt();
  console.log(
    `[backfill] done — populated ${before - after} rows; ${after} still null.`,
  );
  if (after > 0) {
    console.warn(
      "[backfill] WARNING: some rows are still null (unexpected). Inspect them.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
