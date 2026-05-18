// @vitest-environment node
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const queueAddMock = vi.fn().mockResolvedValue({});
const queueRemoveMock = vi.fn().mockResolvedValue(undefined);
const publishAddMock = vi.fn().mockResolvedValue({});
const publishRemoveMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/queue/queues", () => ({
  aiEnrichQueue: { add: queueAddMock, remove: queueRemoveMock },
  etsyPublishQueue: { add: publishAddMock, remove: publishRemoveMock },
}));

// `enqueueEnrichJob` consults `latestRunForKind` to decide whether to
// skip (latest = succeeded) or proceed. Default mock returns null so
// the queue path runs; individual tests override per-case.
const latestRunForKindMock = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/integrations/openai/ai-runs-log", () => ({
  latestRunForKind: latestRunForKindMock,
}));

type UpdateCall = {
  table: "products";
  values: Record<string, unknown>;
};
type InsertCall = {
  table: "events";
  values: Record<string, unknown>;
};
type DeleteCall = {
  table: string;
};

const dbState: {
  updateCalls: UpdateCall[];
  insertCalls: InsertCall[];
  deleteCalls: DeleteCall[];
  fakeUpdatedAt: Date;
  shouldThrowOnUpdate: boolean;
} = {
  updateCalls: [],
  insertCalls: [],
  deleteCalls: [],
  fakeUpdatedAt: new Date("2026-06-01T12:00:00.000Z"),
  shouldThrowOnUpdate: false,
};

vi.mock("@/lib/db/client", () => {
  // The drizzle chain we need to mock:
  //
  //   db.update(table).set(values).where(condition)
  //   db.update(table).set(values).where(condition).returning(...)
  //   db.insert(table).values(values)
  //
  // We use a real Promise as the `.where()` result and attach
  // `.returning()` to it so both call shapes work without a custom
  // thenable (which fights TypeScript's PromiseLike generics).
  const update = (_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        let rejectErr: Error | null = null;
        if (dbState.shouldThrowOnUpdate) {
          rejectErr = new Error("db boom");
        } else {
          dbState.updateCalls.push({ table: "products", values });
        }
        const basePromise: Promise<void> = rejectErr
          ? Promise.reject(rejectErr)
          : Promise.resolve();
        // Suppress unhandled-rejection warnings when the caller
        // skips straight to .returning() without awaiting.
        basePromise.catch(() => {});
        return Object.assign(basePromise, {
          returning: async () => {
            if (rejectErr) throw rejectErr;
            return [{ updatedAt: dbState.fakeUpdatedAt }];
          },
        });
      },
    }),
  });
  const insert = (_table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      dbState.insertCalls.push({ table: "events", values });
      return Promise.resolve();
    },
  });
  const del = (table: unknown) => ({
    where: () => {
      // Best-effort table name introspection — drizzle exposes the
      // table name on `_.name` in current versions. Falls back to
      // "unknown" so the test can still assert "a delete happened".
      const name =
        (table as { _?: { name?: string } } | null)?._?.name ?? "unknown";
      dbState.deleteCalls.push({ table: name });
      return Promise.resolve();
    },
  });
  return { db: { update, insert, delete: del } };
});

const {
  archiveProduct,
  cancelSchedule,
  enqueueEnrichJob,
  restoreToDraft,
  saveDraftAndExit,
  scheduleProduct,
  updateProductDraftField,
} = await import("./draft-actions");

beforeEach(() => {
  dbState.updateCalls = [];
  dbState.insertCalls = [];
  dbState.deleteCalls = [];
  dbState.shouldThrowOnUpdate = false;
  queueAddMock.mockClear();
  queueAddMock.mockResolvedValue({});
  queueRemoveMock.mockClear();
  queueRemoveMock.mockResolvedValue(undefined);
  publishAddMock.mockClear();
  publishAddMock.mockResolvedValue({});
  publishRemoveMock.mockClear();
  publishRemoveMock.mockResolvedValue(undefined);
  latestRunForKindMock.mockReset();
  latestRunForKindMock.mockResolvedValue(null);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("updateProductDraftField", () => {
  it("persists a valid partial patch and returns the new updatedAt", async () => {
    const res = await updateProductDraftField("p1", {
      titleEs: "Vestido años 80",
      basePriceCents: 4500,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.savedAt).toBe(dbState.fakeUpdatedAt.toISOString());
    }
    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      titleEs: "Vestido años 80",
      basePriceCents: 4500,
    });
  });

  it("coerces a scheduledPublishAt ISO string into a Date for the DB", async () => {
    const iso = "2026-06-01T12:00:00.000Z";
    const res = await updateProductDraftField("p1", {
      scheduledPublishAt: iso,
    });
    expect(res.ok).toBe(true);
    const captured = dbState.updateCalls[0]?.values.scheduledPublishAt;
    expect(captured).toBeInstanceOf(Date);
    expect((captured as Date).toISOString()).toBe(iso);
  });

  it("short-circuits with a fresh savedAt when the patch is empty", async () => {
    const res = await updateProductDraftField("p1", {});
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("rejects a patch that fails zod validation", async () => {
    const res = await updateProductDraftField("p1", {
      basePriceCents: -10,
    });
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("returns an error result when the DB throws", async () => {
    dbState.shouldThrowOnUpdate = true;
    const res = await updateProductDraftField("p1", {
      titleEs: "Anything",
    });
    expect(res.ok).toBe(false);
  });

  it("auto-sets etsyTaxonomyId when clothingType is in the patch", async () => {
    // ETSY_TAXONOMIES currently ship with placeholder id=0 across the
    // board, so the resolver maps every clothing type to null until
    // the real Etsy taxonomy IDs are imported. The point of this test
    // is the *behavior* (the key is present and derived), not the id.
    const res = await updateProductDraftField("p1", { clothingType: "dress" });
    expect(res.ok).toBe(true);
    const values = dbState.updateCalls[0]?.values;
    expect(values).toHaveProperty("etsyTaxonomyId");
    expect(values?.etsyTaxonomyId).toBeNull();
    expect(values?.clothingType).toBe("dress");
  });

  it("clears etsyTaxonomyId when clothingType is explicitly cleared", async () => {
    const res = await updateProductDraftField("p1", { clothingType: null });
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.etsyTaxonomyId).toBeNull();
  });

  it("does not touch etsyTaxonomyId when clothingType is absent from the patch", async () => {
    const res = await updateProductDraftField("p1", { titleEs: "Cualquier" });
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).not.toHaveProperty(
      "etsyTaxonomyId",
    );
  });
});

describe("saveDraftAndExit", () => {
  it("forces status back to draft", async () => {
    const res = await saveDraftAndExit("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "draft",
    });
  });
});

describe("archiveProduct", () => {
  it("sets status to archived", async () => {
    const res = await archiveProduct("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "archived",
    });
  });
});

describe("restoreToDraft", () => {
  it("sets status back to draft", async () => {
    const res = await restoreToDraft("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "draft",
    });
  });
});

describe("cancelSchedule", () => {
  it("clears scheduled_publish_at and reverts to draft", async () => {
    const res = await cancelSchedule("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "draft",
      scheduledPublishAt: null,
    });
  });

  it("removes the pending etsy-publish delayed job", async () => {
    await cancelSchedule("p1");
    expect(publishRemoveMock).toHaveBeenCalledWith("p1");
    expect(publishAddMock).not.toHaveBeenCalled();
  });

  it("swallows queue remove() errors (race: BullMQ throws when the job is already active)", async () => {
    publishRemoveMock.mockRejectedValueOnce(new Error("job is active"));
    const res = await cancelSchedule("p1");
    expect(res.ok).toBe(true);
    // The DB update still succeeded — the active worker will see
    // status='draft' and self-cancel on its race-safety check.
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "draft",
    });
  });
});

describe("enqueueEnrichJob", () => {
  it("clears prior failed enrich runs and stale queue jobs, then adds a new one", async () => {
    const res = await enqueueEnrichJob("p1");
    expect(res.ok).toBe(true);

    // Stale-failure cleanup: at least one delete against ai_runs.
    expect(dbState.deleteCalls.length).toBeGreaterThanOrEqual(1);

    // BullMQ dedup defense: remove any old job with this id first.
    expect(queueRemoveMock).toHaveBeenCalledWith("p1");

    // Queue add: name "enrich", payload { productId }, jobId = productId.
    expect(queueAddMock).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = queueAddMock.mock.calls[0]!;
    expect(name).toBe("enrich");
    expect(payload).toEqual({ productId: "p1" });
    expect(opts.jobId).toBe("p1");
  });

  it("swallows remove() errors so a missing or active job doesn't block the add()", async () => {
    queueRemoveMock.mockRejectedValueOnce(new Error("job is active"));
    const res = await enqueueEnrichJob("p1");
    expect(res.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });

  it("returns an error result when the queue add throws", async () => {
    queueAddMock.mockRejectedValueOnce(new Error("redis down"));
    const res = await enqueueEnrichJob("p1");
    expect(res.ok).toBe(false);
  });

  it("skips the enqueue when the latest run is already succeeded (idempotency)", async () => {
    latestRunForKindMock.mockResolvedValueOnce({
      id: "run-prev",
      kind: "enrich",
      status: "succeeded",
    });
    const res = await enqueueEnrichJob("p1");
    expect(res.ok).toBe(true);
    expect(latestRunForKindMock).toHaveBeenCalledWith("p1", "enrich");
    // No queue add, no remove, no delete — we returned before any of that.
    expect(queueAddMock).not.toHaveBeenCalled();
    expect(queueRemoveMock).not.toHaveBeenCalled();
    expect(dbState.deleteCalls).toHaveLength(0);
  });

  it("still enqueues when the latest run is failed (recoverable retry)", async () => {
    latestRunForKindMock.mockResolvedValueOnce({
      id: "run-prev",
      kind: "enrich",
      status: "failed",
    });
    const res = await enqueueEnrichJob("p1");
    expect(res.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });

  it("forces a re-enqueue when force=true, even if the latest run succeeded", async () => {
    latestRunForKindMock.mockResolvedValueOnce({
      id: "run-prev",
      kind: "enrich",
      status: "succeeded",
    });
    const res = await enqueueEnrichJob("p1", { force: true });
    expect(res.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
    // Force path doesn't even consult the latest-run lookup — short-
    // circuit happens before the DB read.
    expect(latestRunForKindMock).not.toHaveBeenCalled();
  });
});

describe("scheduleProduct", () => {
  it("schedules a product more than 5 minutes in the future", async () => {
    const target = new Date("2026-06-01T11:00:00.000Z"); // 1 h ahead
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(true);
    const values = dbState.updateCalls[0]?.values;
    expect(values).toMatchObject({ status: "scheduled" });
    expect(values?.scheduledPublishAt).toBeInstanceOf(Date);
    expect((values?.scheduledPublishAt as Date).toISOString()).toBe(
      target.toISOString(),
    );
  });

  it("enqueues a delayed etsy-publish job with delay = target - now", async () => {
    const target = new Date("2026-06-01T11:00:00.000Z"); // 1 h ahead
    await scheduleProduct("p1", target.toISOString());

    // Remove-first defense against re-scheduling on the same id.
    expect(publishRemoveMock).toHaveBeenCalledWith("p1");

    expect(publishAddMock).toHaveBeenCalledTimes(1);
    const [name, payload, opts] = publishAddMock.mock.calls[0]!;
    expect(name).toBe("publish");
    expect(payload).toEqual({ productId: "p1" });
    expect(opts.jobId).toBe("p1");
    // 1 hour = 3 600 000 ms.
    expect(opts.delay).toBe(60 * 60 * 1000);
  });

  it("swallows queue remove() errors when re-scheduling over an active job", async () => {
    publishRemoveMock.mockRejectedValueOnce(new Error("job is active"));
    const target = new Date("2026-06-01T11:00:00.000Z");
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(true);
    expect(publishAddMock).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue when scheduleProduct fails validation", async () => {
    const target = new Date("2026-06-01T10:01:00.000Z"); // 1 min ahead — too soon
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(false);
    expect(publishAddMock).not.toHaveBeenCalled();
  });

  it("rejects an ISO datetime less than 5 minutes ahead", async () => {
    const target = new Date("2026-06-01T10:01:00.000Z"); // 1 min ahead
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("rejects a datetime more than 6 months ahead", async () => {
    const target = new Date("2027-01-01T10:00:00.000Z"); // ~7 mo
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("rejects a non-ISO string", async () => {
    const res = await scheduleProduct("p1", "mañana a las 5");
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });

  it("accepts the boundary case at exactly 5 minutes + 1 ms ahead", async () => {
    const target = new Date("2026-06-01T10:05:00.001Z");
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(true);
  });

  it("returns an error result when the DB throws", async () => {
    dbState.shouldThrowOnUpdate = true;
    const target = new Date("2026-06-01T11:00:00.000Z");
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(false);
  });
});
