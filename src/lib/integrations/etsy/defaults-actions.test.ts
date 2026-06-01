// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mocks must be declared before the dynamic import below.
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

type Captured = {
  shippingProfileLightId?: number | null;
  shippingProfileMediumId?: number | null;
  shippingProfileHeavyId?: number | null;
  defaultReturnPolicyId?: number | null;
  defaultReadinessStateId?: number | null;
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

const {
  saveShippingMapping,
  saveReturnPolicy,
  saveReadinessState,
  saveShopMarkup,
} = await import("./defaults-actions");

describe("saveShippingMapping", () => {
  it("coerces numeric strings to numbers and persists them", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShippingMapping({
      shippingProfileLightId: "5001",
      shippingProfileMediumId: "5002",
      shippingProfileHeavyId: "5003",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.shippingProfileLightId).toBe(5001);
    expect(dbState.updateCalls[0]?.shippingProfileMediumId).toBe(5002);
    expect(dbState.updateCalls[0]?.shippingProfileHeavyId).toBe(5003);
  });

  it("treats empty Etsy IDs as null", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShippingMapping({
      shippingProfileLightId: "",
      shippingProfileMediumId: "",
      shippingProfileHeavyId: "",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.shippingProfileLightId).toBeNull();
    expect(dbState.updateCalls[0]?.shippingProfileMediumId).toBeNull();
    expect(dbState.updateCalls[0]?.shippingProfileHeavyId).toBeNull();
  });

  it("rejects non-numeric input", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveShippingMapping({
      shippingProfileLightId: "not-a-number",
      shippingProfileMediumId: "5002",
      shippingProfileHeavyId: "5003",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("returns an error when there's no etsy_oauth row", async () => {
    dbState.rows = [];
    dbState.updateCalls.length = 0;
    const res = await saveShippingMapping({
      shippingProfileLightId: "5001",
      shippingProfileMediumId: "5002",
      shippingProfileHeavyId: "5003",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    dbState.rows = [{ id: "row-1" }];
  });
});

describe("saveReturnPolicy", () => {
  it("persists a numeric return policy id", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveReturnPolicy({ returnPolicyId: "7001" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultReturnPolicyId).toBe(7001);
  });

  it("treats empty as null", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveReturnPolicy({ returnPolicyId: "" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultReturnPolicyId).toBeNull();
  });
});

describe("saveReadinessState", () => {
  it("persists a numeric readiness state id", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveReadinessState({ readinessStateId: "4242" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultReadinessStateId).toBe(4242);
  });

  it("treats empty as null", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveReadinessState({ readinessStateId: "" });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.defaultReadinessStateId).toBeNull();
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
