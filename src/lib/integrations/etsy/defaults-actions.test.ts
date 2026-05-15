// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mocks must be declared before the dynamic import below.
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

const dbState: {
  rows: Array<{ id: string }>;
  updateCalls: Array<{
    defaultShippingProfileId: number | null;
    defaultReturnPolicyId: number | null;
  }>;
} = { rows: [{ id: "row-1" }], updateCalls: [] };

vi.mock("@/lib/db/client", () => {
  const select = () => ({
    from: () => ({
      limit: async () => dbState.rows,
    }),
  });
  const update = () => ({
    set: (values: {
      defaultShippingProfileId: number | null;
      defaultReturnPolicyId: number | null;
    }) => ({
      where: async () => {
        dbState.updateCalls.push({
          defaultShippingProfileId: values.defaultShippingProfileId,
          defaultReturnPolicyId: values.defaultReturnPolicyId,
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
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls).toEqual([
      { defaultShippingProfileId: 5001, defaultReturnPolicyId: 7001 },
    ]);
  });

  it("treats empty strings as null", async () => {
    dbState.updateCalls.length = 0;
    const res = await saveEtsyDefaults({
      shippingProfileId: "",
      returnPolicyId: "",
    });
    expect(res).toEqual({ ok: true });
    expect(dbState.updateCalls).toEqual([
      { defaultShippingProfileId: null, defaultReturnPolicyId: null },
    ]);
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
    // restore for any later test
    dbState.rows = [{ id: "row-1" }];
  });
});
