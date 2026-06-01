// NOTE: no `import "server-only"` — this module is on the inbound
// worker's import chain (`inbound-worker.ts` → here → `listings.ts`)
// and `tsx` has no React server-condition shim. See `client.ts`.

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { websiteWebhookQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import { loadShopConfig } from "./publish";
import {
  etsyPriceToCents,
  getListing,
  getShopReceipts,
  type Receipt,
} from "./listings";

const dev = devGroup("etsy.inbound");

/** Receipts page size pulled per poll — comfortably covers a 15-min
 *  window of sales for this shop's volume. */
const RECEIPTS_PAGE_LIMIT = 100;

/**
 * Inbound Etsy→admin sync.
 *
 * Etsy has no push webhooks, so a scheduled poll reads each published
 * listing's authoritative price + state and the shop's recent receipts,
 * then this pure reconciler decides the minimal product patch. Keeping
 * the decision logic free of I/O makes every rule unit-testable.
 *
 * Scope is deliberately narrow (see product spec): only price, listing
 * state, and the sold transition flow Etsy→admin. All editable content
 * stays admin-authoritative and flows admin→Etsy only.
 */

/** The product fields the reconciler reads. */
export type InboundLocalSnapshot = {
  status: string;
  /** Last mirrored Etsy lifecycle state (`active`/`inactive`/…). */
  etsyState: string | null;
  /** Last observed Etsy listing price, in cents (mirror column). */
  etsyPriceCents: number | null;
};

/** The authoritative facts read back from Etsy for one listing. */
export type InboundRemoteSnapshot = {
  state: string;
  priceCents: number;
};

export type ReconcileOptions = {
  /** True when a paid receipt referenced this listing. */
  sold: boolean;
  /** Sale time from the receipt; falls back to `now` when absent. */
  soldAt?: Date;
  now: Date;
};

/**
 * The minimal set of product columns to update. An empty object means
 * "nothing changed" — the processor skips the write entirely so an
 * unchanged listing costs zero DB writes per poll.
 */
export type InboundPatch = {
  etsyPriceCents?: number;
  etsyPriceSyncedAt?: Date;
  etsyState?: string;
  status?: "sold";
  soldAt?: Date;
};

/**
 * Decide how to reconcile one product against its Etsy listing.
 *
 * Rules:
 *  - Mirror price into `etsyPriceCents` whenever it differs (display
 *    only — never feeds back into the charm-priced outbound payload).
 *  - Mirror `etsyState` whenever it differs.
 *  - On a fresh sale, transition `status` → `sold` with `soldAt`.
 *  - `sold` is terminal: never un-sell or re-stamp an already-sold
 *    product, but still mirror its price/state for the record.
 */
export function reconcileInbound(
  local: InboundLocalSnapshot,
  remote: InboundRemoteSnapshot,
  opts: ReconcileOptions,
): InboundPatch {
  const patch: InboundPatch = {};

  if (remote.priceCents !== local.etsyPriceCents) {
    patch.etsyPriceCents = remote.priceCents;
    patch.etsyPriceSyncedAt = opts.now;
  }

  if (remote.state !== local.etsyState) {
    patch.etsyState = remote.state;
  }

  if (opts.sold && local.status !== "sold") {
    patch.status = "sold";
    patch.soldAt = opts.soldAt ?? opts.now;
  }

  return patch;
}

export type InboundSyncResult = {
  ok: true;
  /** Published listings polled this cycle. */
  checked: number;
  /** Products that received a DB patch. */
  updated: number;
  /** Products transitioned to `sold` this cycle. */
  sold: number;
};

/**
 * Inbound sync poll processor (runs every 15 min from the
 * `etsy-inbound-sync` repeatable job).
 *
 * Etsy has no push webhooks, so this reads each published listing's
 * authoritative price + state via `getListing` and matches the shop's
 * recent paid receipts against listing ids to detect sales, then
 * applies the minimal {@link reconcileInbound} patch per product.
 *
 * One `getShopReceipts` call covers the whole shop; `getListing` is
 * one call per published product. A single listing's read failure is
 * logged and skipped so one bad listing can't stall the whole cycle —
 * the BullMQ worker only retries on a thrown (shop-wide) failure.
 */
export async function runInboundSync(): Promise<InboundSyncResult> {
  const shop = await loadShopConfig();

  // Only listings that actually exist on Etsy and aren't already in a
  // terminal local state. `sold` rows are excluded — the transition is
  // one-way, so re-polling them would waste an API call per cycle.
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        inArray(products.status, ["published", "scheduled"]),
        isNotNull(products.etsyListingId),
      ),
    );

  const receipts = await getShopReceipts(shop.shopId, {
    wasPaid: true,
    limit: RECEIPTS_PAGE_LIMIT,
  });
  const soldMap = soldListingsFromReceipts(receipts);
  const now = new Date();

  let updated = 0;
  let sold = 0;

  for (const row of rows) {
    const listingId = Number(row.etsyListingId);

    let listing;
    try {
      listing = await getListing(shop.shopId, listingId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dev.warn("getListing failed — skipping product", row.id, msg);
      continue;
    }

    const priceCents = listing.price
      ? etsyPriceToCents(listing.price)
      : (row.etsyPriceCents ?? 0);
    const soldAt = soldMap.get(listingId);

    const patch = reconcileInbound(
      {
        status: row.status,
        etsyState: row.etsyState,
        etsyPriceCents: row.etsyPriceCents,
      },
      { state: listing.state, priceCents },
      { sold: soldAt != null, soldAt, now },
    );

    if (Object.keys(patch).length === 0) continue;

    await db.update(products).set(patch).where(eq(products.id, row.id));
    updated++;

    if (patch.status === "sold") {
      sold++;
      // Best-effort: tell the website to pull the now-sold listing.
      // jobId coalesces repeat archives for the same product.
      try {
        await websiteWebhookQueue.add(
          "archive",
          { productId: row.id, kind: "archive" },
          { jobId: `archive:${row.id}` },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        dev.warn("archive webhook enqueue failed (non-fatal)", row.id, msg);
      }
    }
  }

  dev.log("inbound sync complete", `checked=${rows.length}`, `updated=${updated}`, `sold=${sold}`);
  return { ok: true, checked: rows.length, updated, sold };
}

/**
 * Reduce shop receipts to a `listing_id → sale Date` map. Etsy stamps
 * receipts in unix seconds; we keep the earliest sale per listing so a
 * re-poll never moves an already-recorded `soldAt` forward.
 */
export function soldListingsFromReceipts(
  receipts: Receipt[],
): Map<number, Date> {
  const out = new Map<number, Date>();
  for (const receipt of receipts) {
    const soldAt = new Date(receipt.created_timestamp * 1000);
    for (const tx of receipt.transactions ?? []) {
      const prev = out.get(tx.listing_id);
      if (!prev || soldAt < prev) out.set(tx.listing_id, soldAt);
    }
  }
  return out;
}
