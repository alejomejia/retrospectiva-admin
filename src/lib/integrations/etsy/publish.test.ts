// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type ProductRow = { id: string; status: string };

const dbState: {
  rows: ProductRow[];
  updateCalls: Array<{ values: Record<string, unknown> }>;
} = {
  rows: [],
  updateCalls: [],
};

vi.mock("@/lib/db/client", () => {
  const update = (_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        dbState.updateCalls.push({ values });
        return Promise.resolve();
      },
    }),
  });
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => dbState.rows,
      }),
    }),
  });
  return { db: { update, select } };
});

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
}));

const { runScheduledPublish } = await import("./publish");

beforeEach(() => {
  dbState.rows = [];
  dbState.updateCalls = [];
});

describe("runScheduledPublish (Task 9 stub)", () => {
  it("flips status to 'published' when the row is still scheduled", async () => {
    dbState.rows = [{ id: "p1", status: "scheduled" }];
    const result = await runScheduledPublish("p1");
    expect(result).toEqual({ ok: true, skipped: false });
    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]!.values).toMatchObject({
      status: "published",
    });
  });

  it("skips with reason='missing' when the row doesn't exist", async () => {
    dbState.rows = [];
    const result = await runScheduledPublish("nope");
    expect(result).toEqual({
      ok: true,
      skipped: true,
      reason: "missing",
    });
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it.each([
    ["draft", "user cancelled the schedule before the delay fired"],
    ["archived", "user archived the product"],
    ["published", "another worker beat us to it (impossible but cheap to handle)"],
    ["sold", "lifecycle moved on"],
  ])(
    "skips with reason='status' when the row is %s (%s)",
    async (status) => {
      dbState.rows = [{ id: "p1", status }];
      const result = await runScheduledPublish("p1");
      expect(result).toEqual({
        ok: true,
        skipped: true,
        reason: "status",
      });
      expect(dbState.updateCalls).toHaveLength(0);
    },
  );

  it("bumps updatedAt on a successful publish so consumers keyed on it pick up the change", async () => {
    dbState.rows = [{ id: "p1", status: "scheduled" }];
    await runScheduledPublish("p1");
    // `sql\`now()\`` is a drizzle-orm SQL fragment, so we just assert
    // the key is present rather than match its runtime shape.
    expect(dbState.updateCalls[0]!.values).toHaveProperty("updatedAt");
  });
});
