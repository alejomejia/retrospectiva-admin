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
const webhookAddMock = vi.fn().mockResolvedValue({});

vi.mock("@/lib/queue/queues", () => ({
  aiEnrichQueue: { add: queueAddMock, remove: queueRemoveMock },
  etsyPublishQueue: { add: publishAddMock, remove: publishRemoveMock },
  websiteWebhookQueue: { add: webhookAddMock },
}));

// Featured-cap pre-publish gate. Defaults to "slot available" so the
// existing schedule/publish paths proceed; the cap test flips it.
const featuredSlotFullForProductMock = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/integrations/etsy/publish", () => ({
  featuredSlotFullForProduct: featuredSlotFullForProductMock,
}));

// `enqueueEnrichJob` consults `latestRunForKind` to decide whether to
// skip (latest = succeeded) or proceed. Default mock returns null so
// the queue path runs; individual tests override per-case.
const latestRunForKindMock = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/integrations/openai/ai-runs-log", () => ({
  latestRunForKind: latestRunForKindMock,
}));

const buyPriceDefaultMock = vi.fn().mockResolvedValue(null);
vi.mock("./buy-price-defaults", () => ({
  getBuyPriceDefaultForClothingType: buyPriceDefaultMock,
  getAllBuyPriceDefaults: vi.fn().mockResolvedValue({}),
  saveBuyPriceDefault: vi.fn(),
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
  // Extra fields merged into the row returned by
  // `select().from().where().limit()` so status-guarded actions
  // (markAsSold) can be driven per-test.
  selectRow: Record<string, unknown>;
} = {
  updateCalls: [],
  insertCalls: [],
  deleteCalls: [],
  fakeUpdatedAt: new Date("2026-06-01T12:00:00.000Z"),
  shouldThrowOnUpdate: false,
  selectRow: {},
};

vi.mock("@/lib/db/client", () => {
  // The drizzle chain we need to mock:
  //
  //   db.update(table).set(values).where(condition)
  //   db.update(table).set(values).where(condition).returning(...)
  //   db.insert(table).values(values)
  //   db.select(cols).from(table).where(...).limit(...)
  //
  // We use a real Promise as the `.where()` result and attach
  // `.returning()` to it so both call shapes work without a custom
  // thenable (which fights TypeScript's PromiseLike generics).
  const select = (_cols?: unknown) => ({
    from: (_table: unknown) => ({
      // Support both `select().from().where().limit()` (the autosave
      // path looking up an existing product) and `select().from().limit()`
      // (the etsy-oauth lookup for the shipping-mapping auto-pick).
      limit: async () => [
        {
          buyPriceCents: null,
          shippingProfileLightId: null,
          shippingProfileMediumId: null,
          shippingProfileHeavyId: null,
        },
      ],
      where: (_cond: unknown) => ({
        limit: async () => [{ buyPriceCents: null, ...dbState.selectRow }],
      }),
    }),
  });
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
  return { db: { update, insert, delete: del, select } };
});

const {
  archiveProduct,
  cancelSchedule,
  enqueueEnrichJob,
  markAsPublished,
  markAsSold,
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
  dbState.selectRow = {};
  webhookAddMock.mockClear();
  webhookAddMock.mockResolvedValue({});
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
  featuredSlotFullForProductMock.mockReset();
  featuredSlotFullForProductMock.mockResolvedValue(false);
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
    // The garment selection in step 1 IS the taxonomy choice: the
    // resolver maps `clothingType` to its live Etsy taxonomy id
    // ("dress" -> womens_dresses -> 505).
    const res = await updateProductDraftField("p1", { clothingType: "dress" });
    expect(res.ok).toBe(true);
    const values = dbState.updateCalls[0]?.values;
    expect(values).toHaveProperty("etsyTaxonomyId");
    expect(values?.etsyTaxonomyId).toBe(505);
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

  it("overwrites buyPriceCents with the type's default on every clothingType change", async () => {
    buyPriceDefaultMock.mockResolvedValueOnce(1500);
    const res = await updateProductDraftField("p1", { clothingType: "jacket" });
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.buyPriceCents).toBe(1500);
  });

  it("clears buyPriceCents when no default is set for the new clothingType", async () => {
    buyPriceDefaultMock.mockResolvedValueOnce(null);
    const res = await updateProductDraftField("p1", { clothingType: "jean" });
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.buyPriceCents).toBeNull();
  });

  it("honors an explicit buyPriceCents sent alongside a clothingType change", async () => {
    buyPriceDefaultMock.mockResolvedValueOnce(1500);
    const res = await updateProductDraftField("p1", {
      clothingType: "jacket",
      buyPriceCents: 9999,
    });
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.buyPriceCents).toBe(9999);
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
  it("sets status to archived and notifies the website", async () => {
    const res = await archiveProduct("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "archived",
    });
    expect(webhookAddMock).toHaveBeenCalledWith(
      "archive",
      { productId: "p1", kind: "archive" },
      { jobId: "archive-p1" },
    );
  });
});

describe("markAsSold", () => {
  it("sets status=sold + soldPriceCents + soldAt and fires the sold webhook from a sellable status", async () => {
    dbState.selectRow = { status: "published" };
    const res = await markAsSold("p1", 4200);
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({
      status: "sold",
      soldPriceCents: 4200,
    });
    expect(dbState.updateCalls[0]?.values.soldAt).toBeDefined();
    expect(webhookAddMock).toHaveBeenCalledWith(
      "sold",
      { productId: "p1", kind: "sold" },
      { jobId: "sold-p1" },
    );
  });

  it("rejects a non-sellable status without writing or notifying", async () => {
    dbState.selectRow = { status: "draft" };
    const res = await markAsSold("p1", 4200);
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    expect(webhookAddMock).not.toHaveBeenCalled();
  });

  it("rejects a non-positive sold price without touching the DB", async () => {
    dbState.selectRow = { status: "published" };
    const res = await markAsSold("p1", 0);
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    expect(webhookAddMock).not.toHaveBeenCalled();
  });

  it("rejects a non-integer sold price (cents must be whole)", async () => {
    dbState.selectRow = { status: "published" };
    const res = await markAsSold("p1", 42.5);
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
  });
});

describe("markAsPublished", () => {
  it("flips a scheduled row to published, drops the delayed job, and fires the publish webhook", async () => {
    dbState.selectRow = { status: "scheduled", slug: "vestido-azul", titleEs: "Vestido azul" };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values).toMatchObject({ status: "published" });
    expect(publishRemoveMock).toHaveBeenCalledWith("p1");
    expect(webhookAddMock).toHaveBeenCalledWith(
      "publish",
      { productId: "p1", kind: "publish" },
      { jobId: "publish-p1" },
    );
  });

  it("freezes a slug when the row has none", async () => {
    dbState.selectRow = { status: "scheduled", slug: null, titleEs: "Vestido azul" };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.slug).toEqual(expect.any(String));
    expect(dbState.updateCalls[0]?.values.slug).not.toBe("");
  });

  it("builds the frozen slug from the English title, not the Spanish one", async () => {
    dbState.selectRow = {
      status: "scheduled",
      slug: null,
      titleEs: "Vestido azul",
      titleEn: "Blue dress",
    };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.slug).toMatch(/^blue-dress-/);
  });

  it("falls back to the Spanish title when there is no English title", async () => {
    dbState.selectRow = {
      status: "scheduled",
      slug: null,
      titleEs: "Vestido azul",
      titleEn: null,
    };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.slug).toMatch(/^vestido-azul-/);
  });

  it("keeps an existing frozen slug unchanged", async () => {
    dbState.selectRow = { status: "archived", slug: "kept-slug", titleEs: "Otro" };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(true);
    expect(dbState.updateCalls[0]?.values.slug).toBe("kept-slug");
  });

  it("rejects a non-publishable status without writing or notifying", async () => {
    dbState.selectRow = { status: "draft", slug: null, titleEs: "Borrador" };
    const res = await markAsPublished("p1");
    expect(res.ok).toBe(false);
    expect(dbState.updateCalls).toHaveLength(0);
    expect(webhookAddMock).not.toHaveBeenCalled();
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

  it("schedules regardless of the featured cap — the worker decides at fire time", async () => {
    // Even if the shop is currently full, scheduling must succeed; a
    // slot can free up before the delayed job fires.
    featuredSlotFullForProductMock.mockResolvedValue(true);
    const target = new Date("2026-06-01T11:00:00.000Z");
    const res = await scheduleProduct("p1", target.toISOString());
    expect(res.ok).toBe(true);
    expect(publishAddMock).toHaveBeenCalledTimes(1);
  });
});
