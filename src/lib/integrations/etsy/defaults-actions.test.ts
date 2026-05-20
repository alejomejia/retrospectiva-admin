// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mocks must be declared before the dynamic import below.
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

type Captured = {
  defaultShippingProfileId?: number | null;
  defaultReturnPolicyId?: number | null;
  markupPercent?: number;
};

const dbState: {
  rows: Array<{ id: string }>;
  updateCalls: Captured[];
} = { rows: [{ id: "row-1" }], updateCalls: [] };

vi.mock("@/lib/db/client", () => {
  const select = () => ({
    from: () => ({
      limit: async () => dbState.rows,
    }),
  });
  const update = () => ({
    set: (values: Captured) => ({
      where: async () => {
        dbState.updateCalls.push(values);
      },
    }),
  });
  return { db: { select, update } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveEtsyDefaults, saveShopMarkup } = await import("./defaults-actions");

describe("saveEtsyDefaults", () => {
  it("coerces numeric strings to numbers and persists them", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "5001",
      returnPolicyId: "7001",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultShippingProfileId).toBe(5001);
    expect(dbState.updateCalls[0]?.defaultReturnPolicyId).toBe(7001);
  });

  it("treats empty Etsy IDs as null", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "",
      returnPolicyId: "",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultShippingProfileId).toBeNull();
    expect(dbState.updateCalls[0]?.defaultReturnPolicyId).toBeNull();
  });

  it("rejects non-numeric input", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "not-a-number",
      returnPolicyId: "7001",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("returns an error when there's no etsy_oauth row", async () => {
    dbState.rows = [];
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "5001",
      returnPolicyId: "7001",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    dbState.rows = [{ id: "row-1" }];
  });
});

describe("saveShopMarkup", () => {
  it("persists numeric markup", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShopMarkup({ markupPercent: "45" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.markupPercent).toBe(45);
  });

  it("treats empty markup as the schema default (30)", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShopMarkup({ markupPercent: "" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.markupPercent).toBe(30);
  });

  it("rejects markup outside [0, 500]", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShopMarkup({ markupPercent: "501" });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("returns an error when there's no etsy_oauth row", async () => {
    dbState.rows = [];
    dbState.updateCalls.length = 0;
    const res = await saveShopMarkup({ markupPercent: "30" });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    dbState.rows = [{ id: "row-1" }];
  });
});
