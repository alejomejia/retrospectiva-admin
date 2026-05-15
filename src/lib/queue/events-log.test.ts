// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * Tests for the queue's lifecycle helpers. Uses a hand-rolled fake
 * `db` so the helpers can be exercised without a real Postgres —
 * the same pattern as `defaults-actions.test.ts`.
 */

type EventRow = {
  productId: string | null;
  actor: string;
  type: string;
  payloadJson: Record<string, unknown>;
};
type IdempotencyRow = { id: string; purpose: string };

const state: {
  events: EventRow[];
  idempotency: IdempotencyRow[];
  insertEventThrows: boolean;
  __lastCheckedKey: string | undefined;
} = {
  events: [],
  idempotency: [],
  insertEventThrows: false,
  __lastCheckedKey: undefined,
};

vi.mock("@/lib/db/client", () => {
  const insert = (table: { _: { name?: string } }) => {
    const tableName = table?._?.name ?? "";
    return {
      values: (v: EventRow | IdempotencyRow) => {
        if (tableName === "events" || "actor" in v) {
          if (state.insertEventThrows) {
            return Promise.reject(new Error("synthetic events insert failure"));
          }
          state.events.push(v as EventRow);
          return Promise.resolve();
        }
        // jobs_idempotency
        const conflictKey = (v as IdempotencyRow).id;
        return {
          onConflictDoNothing: () => {
            if (!state.idempotency.find((r) => r.id === conflictKey)) {
              state.idempotency.push(v as IdempotencyRow);
            }
            return Promise.resolve();
          },
        };
      },
    };
  };

  const select = (_proj?: unknown) => ({
    from: (table: { _: { name?: string } }) => {
      const tableName = table?._?.name ?? "";
      return {
        where: () => ({
          limit: () => {
            if (tableName === "jobs_idempotency") {
              const lastKey = state.__lastCheckedKey;
              const hit = state.idempotency.find((r) => r.id === lastKey);
              return Promise.resolve(hit ? [{ id: hit.id }] : []);
            }
            return Promise.resolve([]);
          },
        }),
      };
    },
  });

  return { db: { insert, select } };
});

// Patch the table imports so we can recognize them by name in the mock.
vi.mock("@/lib/db/schema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/schema")>(
    "@/lib/db/schema",
  );
  return {
    ...actual,
    events: { ...actual.events, _: { name: "events" } },
    jobsIdempotency: {
      ...actual.jobsIdempotency,
      _: { name: "jobs_idempotency" },
    },
  };
});

// drizzle-orm's `eq` is read by the helpers; we capture the key it's
// called with so the select mock can use it.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>(
    "drizzle-orm",
  );
  return {
    ...actual,
    eq: (_col: unknown, val: string) => {
      state.__lastCheckedKey = val;
      return { __eq: val };
    },
  };
});

const { logJobEvent, isJobProcessed, markJobProcessed } = await import(
  "./events-log"
);

describe("logJobEvent", () => {
  it("inserts a row with actor='worker' and a payload merging jobId + custom data", async () => {
    state.events.length = 0;
    await logJobEvent({
      jobId: "job-1",
      type: "etsy_publish.completed",
      productId: "prod-1",
      payload: { listingId: 999 },
    });
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toEqual({
      productId: "prod-1",
      actor: "worker",
      type: "etsy_publish.completed",
      payloadJson: { jobId: "job-1", listingId: 999 },
    });
  });

  it("coerces numeric job IDs to string in the payload", async () => {
    state.events.length = 0;
    await logJobEvent({ jobId: 42, type: "ping.done" });
    expect(state.events[0]?.payloadJson).toMatchObject({ jobId: "42" });
  });

  it("accepts a null productId for non-product-scoped events", async () => {
    state.events.length = 0;
    await logJobEvent({ jobId: "j", type: "system.heartbeat" });
    expect(state.events[0]?.productId).toBeNull();
  });

  it("swallows DB insert failures so a logging hiccup never crashes a job", async () => {
    state.events.length = 0;
    state.insertEventThrows = true;
    await expect(
      logJobEvent({ jobId: "j", type: "x.fail" }),
    ).resolves.toBeUndefined();
    state.insertEventThrows = false;
  });
});

describe("isJobProcessed / markJobProcessed", () => {
  it("returns false before mark, true after", async () => {
    state.idempotency.length = 0;
    expect(await isJobProcessed("etsy-receipt:123")).toBe(false);
    await markJobProcessed("etsy-receipt:123", "etsy-receipt");
    expect(await isJobProcessed("etsy-receipt:123")).toBe(true);
  });

  it("is a no-op on re-mark (no unique-constraint error bubbles up)", async () => {
    state.idempotency.length = 0;
    await markJobProcessed("k", "test");
    await markJobProcessed("k", "test"); // would 23505 without ON CONFLICT
    expect(state.idempotency).toHaveLength(1);
  });
});
