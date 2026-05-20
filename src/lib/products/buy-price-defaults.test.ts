// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Captured = {
  insertValues?: { clothingType: string; defaultBuyPriceCents: number };
  upsertSetValues?: { defaultBuyPriceCents?: number };
  deleted?: boolean;
};

const dbState: { calls: Captured[] } = { calls: [] };

vi.mock("@/lib/db/client", () => {
  const insert = () => ({
    values: (values: { clothingType: string; defaultBuyPriceCents: number }) => {
      const captured: Captured = { insertValues: values };
      dbState.calls.push(captured);
      return {
        onConflictDoUpdate: ({
          set,
        }: {
          target: unknown;
          set: { defaultBuyPriceCents?: number };
        }) => {
          captured.upsertSetValues = set;
          return Promise.resolve();
        },
      };
    },
  });
  const del = () => ({
    where: () => {
      dbState.calls.push({ deleted: true });
      return Promise.resolve();
    },
  });
  const select = () => ({
    from: () => Promise.resolve([] as unknown[]),
  });
  return { db: { insert, delete: del, select } };
});

const { saveBuyPriceDefault } = await import("./buy-price-defaults");

describe("saveBuyPriceDefault", () => {
  it("upserts a numeric EUR value as cents", async () => {
    dbState.calls.length = 0;
    const res = await saveBuyPriceDefault({
      clothingType: "jacket",
      priceEur: "12.50",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.calls[0]?.insertValues).toEqual({
      clothingType: "jacket",
      defaultBuyPriceCents: 1250,
    });
    expect(dbState.calls[0]?.upsertSetValues?.defaultBuyPriceCents).toBe(1250);
  });

  it("deletes the row when given an empty string", async () => {
    dbState.calls.length = 0;
    const res = await saveBuyPriceDefault({
      clothingType: "shirt",
      priceEur: "",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.calls[0]?.deleted).toBe(true);
  });

  it("rejects non-money strings", async () => {
    dbState.calls.length = 0;
    const res = await saveBuyPriceDefault({
      clothingType: "shirt",
      priceEur: "twelve",
    });
    expect(res.ok).toBe(false);
    expect(dbState.calls).toHaveLength(0);
  });

  it("rejects unknown clothing types", async () => {
    dbState.calls.length = 0;
    const res = await saveBuyPriceDefault({
      clothingType: "not-real" as never,
      priceEur: "10.00",
    });
    expect(res.ok).toBe(false);
    expect(dbState.calls).toHaveLength(0);
  });
});
