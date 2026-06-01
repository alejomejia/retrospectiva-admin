// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  reconcileInbound,
  soldListingsFromReceipts,
  type InboundLocalSnapshot,
} from "./inbound";
import type { Receipt } from "./listings";

const NOW = new Date("2026-05-31T12:00:00.000Z");

function local(
  over: Partial<InboundLocalSnapshot> = {},
): InboundLocalSnapshot {
  return {
    status: "published",
    etsyState: "active",
    etsyPriceCents: 4200,
    ...over,
  };
}

describe("soldListingsFromReceipts", () => {
  function receipt(
    id: number,
    created: number,
    listingIds: number[],
  ): Receipt {
    return {
      receipt_id: id,
      created_timestamp: created,
      transactions: listingIds.map((listing_id, i) => ({
        transaction_id: id * 10 + i,
        listing_id,
      })),
    };
  }

  it("maps each sold listing_id to its sale Date (unix seconds → ms)", () => {
    const out = soldListingsFromReceipts([
      receipt(1, 1_700_000_000, [42, 43]),
    ]);
    expect(out.get(42)).toEqual(new Date(1_700_000_000 * 1000));
    expect(out.get(43)).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("keeps the earliest sale when a listing appears in multiple receipts", () => {
    const out = soldListingsFromReceipts([
      receipt(2, 1_700_000_500, [42]),
      receipt(1, 1_700_000_000, [42]),
    ]);
    expect(out.get(42)).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("returns an empty map for no receipts", () => {
    expect(soldListingsFromReceipts([]).size).toBe(0);
  });
});

describe("reconcileInbound", () => {
  it("returns no patch when nothing changed", () => {
    const patch = reconcileInbound(
      local(),
      { state: "active", priceCents: 4200 },
      { sold: false, now: NOW },
    );
    expect(patch).toEqual({});
  });

  it("patches etsyPriceCents when the Etsy price changed", () => {
    const patch = reconcileInbound(
      local({ etsyPriceCents: 4200 }),
      { state: "active", priceCents: 3500 },
      { sold: false, now: NOW },
    );
    expect(patch.etsyPriceCents).toBe(3500);
    expect(patch.etsyPriceSyncedAt).toEqual(NOW);
  });

  it("patches the price on first observation (local null)", () => {
    const patch = reconcileInbound(
      local({ etsyPriceCents: null }),
      { state: "active", priceCents: 4200 },
      { sold: false, now: NOW },
    );
    expect(patch.etsyPriceCents).toBe(4200);
  });

  it("mirrors a changed listing state", () => {
    const patch = reconcileInbound(
      local({ etsyState: "active" }),
      { state: "inactive", priceCents: 4200 },
      { sold: false, now: NOW },
    );
    expect(patch.etsyState).toBe("inactive");
  });

  it("marks sold: status=sold + soldAt from the receipt", () => {
    const soldAt = new Date("2026-05-30T09:00:00.000Z");
    const patch = reconcileInbound(
      local({ status: "published" }),
      { state: "inactive", priceCents: 4200 },
      { sold: true, soldAt, now: NOW },
    );
    expect(patch.status).toBe("sold");
    expect(patch.soldAt).toEqual(soldAt);
  });

  it("falls back to now for soldAt when the receipt has no timestamp", () => {
    const patch = reconcileInbound(
      local({ status: "published" }),
      { state: "inactive", priceCents: 4200 },
      { sold: true, now: NOW },
    );
    expect(patch.soldAt).toEqual(NOW);
  });

  it("is terminal: does not re-sell or unset an already-sold product", () => {
    const patch = reconcileInbound(
      local({ status: "sold" }),
      { state: "active", priceCents: 4200 },
      { sold: true, soldAt: NOW, now: NOW },
    );
    expect(patch.status).toBeUndefined();
    expect(patch.soldAt).toBeUndefined();
  });

  it("still mirrors price/state on an already-sold product", () => {
    const patch = reconcileInbound(
      local({ status: "sold", etsyPriceCents: 4200 }),
      { state: "active", priceCents: 3000 },
      { sold: false, now: NOW },
    );
    expect(patch.etsyPriceCents).toBe(3000);
    expect(patch.status).toBeUndefined();
  });
});
