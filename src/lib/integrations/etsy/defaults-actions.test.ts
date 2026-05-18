// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mocks must be declared before the dynamic import below.
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

type Captured = {
  defaultShippingProfileId: number | null;
  defaultReturnPolicyId: number | null;
  markupPercent: number;
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
        dbState.updateCalls.push({
          defaultShippingProfileId: values.defaultShippingProfileId,
          defaultReturnPolicyId: values.defaultReturnPolicyId,
          markupPercent: values.markupPercent,
        });
      },
    }),
  });
  return { db: { select, update } };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveEtsyDefaults } = await import("./defaults-actions");

describe("saveEtsyDefaults", () => {
  it("coerces numeric strings to numbers and persists them", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "5001",
      returnPolicyId: "7001",
      markupPercent: "30",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls).toEqual([
      {
        defaultShippingProfileId: 5001,
        defaultReturnPolicyId: 7001,
        markupPercent: 30,
      },
    ]);
  });

  it("treats empty Etsy IDs as null and empty markup as the default", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "",
      returnPolicyId: "",
      markupPercent: "",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls).toEqual([
      {
        defaultShippingProfileId: null,
        defaultReturnPolicyId: null,
        markupPercent: 30,
      },
    ]);
  });

  it("accepts a custom markup percent and persists it as a number", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "",
      returnPolicyId: "",
      markupPercent: "45",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls[0]?.markupPercent).toBe(45);
  });

  it("rejects markup outside [0, 500]", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "",
      returnPolicyId: "",
      markupPercent: "501",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("rejects non-numeric input", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "not-a-number",
      returnPolicyId: "7001",
      markupPercent: "30",
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
      markupPercent: "30",
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    // restore for any later test
    dbState.rows = [{ id: "row-1" }];
  });
});
