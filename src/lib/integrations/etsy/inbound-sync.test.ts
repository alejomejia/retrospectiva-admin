// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type ProductRow = Record<string, unknown> & { id: string; status: string };

const state: {
  products: ProductRow[];
  etsyOauth: Array<Record<string, unknown>>;
  updates: Array<{ id: unknown; values: Record<string, unknown> }>;
  listings: Record<number, { state: string; priceCents: number }>;
  receipts: Array<{
    receipt_id: number;
    created_timestamp: number;
    transactions: Array<{ transaction_id: number; listing_id: number }>;
  }>;
  webhookAdds: Array<{ name: string; data: unknown }>;
  getListingThrowsFor: Set<number>;
} = {
  products: [],
  etsyOauth: [],
  updates: [],
  listings: {},
  receipts: [],
  webhookAdds: [],
  getListingThrowsFor: new Set(),
};

// loadShopConfig reads etsy_oauth (limit 1, no where); then the
// processor reads the published products list (where, no limit).
let selectSeq = 0;
const SELECT_PLAN: Array<keyof typeof state> = ["etsyOauth", "products"];

function nextRows(): unknown[] {
  const table = SELECT_PLAN[selectSeq++] ?? "products";
  return state[table] as unknown[];
}

vi.mock("@/lib/db/client", () => {
  const buildSelect = () => ({
    from: () => {
      let resolved: unknown[] | null = null;
      const resolve = () => {
        if (resolved === null) resolved = nextRows();
        return resolved;
      };
      return {
        where: () => {
          const thenable = Promise.resolve().then(() =>
            resolve(),
          ) as Promise<unknown[]> & {
            limit: (n: number) => Promise<unknown[]>;
          };
          thenable.limit = async (_n: number) => resolve();
          return thenable;
        },
        limit: async (_n: number) => resolve(),
      };
    },
  });
  const update = (_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: (cond: unknown) => {
        state.updates.push({ id: cond, values });
        return Promise.resolve();
      },
    }),
  });
  return { db: { select: buildSelect, update } };
});

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
}));

vi.mock("@/lib/queue/queues", () => ({
  websiteWebhookQueue: {
    add: vi.fn(async (name: string, data: unknown) => {
      state.webhookAdds.push({ name, data });
    }),
  },
}));

vi.mock("./listings", () => ({
  etsyPriceToCents: (p: { amount: number; divisor: number }) =>
    Math.round((p.amount / p.divisor) * 100),
  getListing: vi.fn(async (_shop: number, listingId: number) => {
    if (state.getListingThrowsFor.has(listingId)) {
      throw new Error(`Etsy getListing failed: 404`);
    }
    const l = state.listings[listingId];
    if (!l) throw new Error(`no test listing ${listingId}`);
    return {
      listing_id: listingId,
      state: l.state,
      quantity: 1,
      price: { amount: l.priceCents, divisor: 100, currency_code: "USD" },
    };
  }),
  getShopReceipts: vi.fn(async () => state.receipts),
}));

const { runInboundSync } = await import("./inbound");

function product(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "p1",
    status: "published",
    etsyListingId: 42,
    etsyState: "active",
    etsyPriceCents: 4200,
    ...over,
  };
}

beforeEach(() => {
  selectSeq = 0;
  state.products = [];
  state.etsyOauth = [{ shopId: 777, markupPercent: 30 }];
  state.updates = [];
  state.listings = {};
  state.receipts = [];
  state.webhookAdds = [];
  state.getListingThrowsFor = new Set();
});

describe("runInboundSync", () => {
  it("writes nothing when Etsy matches local state", async () => {
    state.products = [product()];
    state.listings = { 42: { state: "active", priceCents: 4200 } };
    const res = await runInboundSync();
    expect(res).toMatchObject({ ok: true, checked: 1, updated: 0, sold: 0 });
    expect(state.updates).toHaveLength(0);
  });

  it("mirrors a changed Etsy price into etsyPriceCents", async () => {
    state.products = [product({ etsyPriceCents: 4200 })];
    state.listings = { 42: { state: "active", priceCents: 3500 } };
    const res = await runInboundSync();
    expect(res.updated).toBe(1);
    expect(state.updates[0]!.values).toMatchObject({ etsyPriceCents: 3500 });
    expect(state.updates[0]!.values.etsyPriceSyncedAt).toBeInstanceOf(Date);
  });

  it("marks a product sold when a paid receipt references its listing", async () => {
    state.products = [product({ status: "published" })];
    state.listings = { 42: { state: "inactive", priceCents: 4200 } };
    state.receipts = [
      {
        receipt_id: 1,
        created_timestamp: 1_700_000_000,
        transactions: [{ transaction_id: 9, listing_id: 42 }],
      },
    ];
    const res = await runInboundSync();
    expect(res.sold).toBe(1);
    expect(state.updates[0]!.values).toMatchObject({ status: "sold" });
    expect(state.updates[0]!.values.soldAt).toEqual(
      new Date(1_700_000_000 * 1000),
    );
    // sold → website archive webhook fired
    expect(state.webhookAdds).toEqual([
      { name: "archive", data: { productId: "p1", kind: "archive" } },
    ]);
  });

  it("continues past a listing whose getListing call fails", async () => {
    state.products = [
      product({ id: "p1", etsyListingId: 42 }),
      product({ id: "p2", etsyListingId: 43, etsyPriceCents: 1000 }),
    ];
    state.getListingThrowsFor = new Set([42]);
    state.listings = { 43: { state: "active", priceCents: 2000 } };
    const res = await runInboundSync();
    expect(res.checked).toBe(2);
    expect(res.updated).toBe(1);
    expect(state.updates[0]!.values).toMatchObject({ etsyPriceCents: 2000 });
  });
});
