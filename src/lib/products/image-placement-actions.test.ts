// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({ username: "test" }),
}));

const queueAddMock = vi.fn().mockResolvedValue({});
const queueRemoveMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/queue/queues", () => ({
  aiImagePlacementQueue: { add: queueAddMock, remove: queueRemoveMock },
}));

const latestRunForKindMock = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/integrations/openai/ai-runs-log", () => ({
  latestRunForKind: latestRunForKindMock,
}));

const getSettingsMock = vi
  .fn()
  .mockResolvedValue({ aiImageEnabled: true });
vi.mock("./settings", () => ({
  getProductSettings: getSettingsMock,
}));

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
}));

type ProductRow = {
  id: string;
  aiImageEnabled: boolean | null;
  aiModelId: string | null;
  clothingType: string | null;
};

const dbState: {
  products: ProductRow[];
  aiReferenceRows: Array<{ id: string }>;
  deleteCalls: number;
} = {
  products: [],
  aiReferenceRows: [],
  deleteCalls: 0,
};

vi.mock("@/lib/db/client", async () => {
  // Dispatch select() reads by the table identity passed to .from(),
  // not by call order — toggle-blocked paths only run the products
  // select and would otherwise desynchronize a per-call counter.
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>(
    "@/lib/db/schema",
  );
  return {
    db: {
      select: (_cols?: unknown) => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => {
              if (table === schema.products) return dbState.products;
              if (table === schema.productImages) return dbState.aiReferenceRows;
              return [];
            },
          }),
        }),
      }),
      delete: (_table: unknown) => ({
        where: () => {
          dbState.deleteCalls += 1;
          return Promise.resolve();
        },
      }),
    },
  };
});

const { generateProductImage } = await import("./image-placement-actions");

const baseProduct: ProductRow = {
  id: "p1",
  aiImageEnabled: true,
  aiModelId: "m1",
  clothingType: "jacket",
};

beforeEach(() => {
  dbState.products = [{ ...baseProduct }];
  dbState.aiReferenceRows = [{ id: "img-ref-1" }];
  dbState.deleteCalls = 0;
  queueAddMock.mockReset();
  queueAddMock.mockResolvedValue({});
  queueRemoveMock.mockReset();
  queueRemoveMock.mockResolvedValue(undefined);
  latestRunForKindMock.mockReset();
  latestRunForKindMock.mockResolvedValue(null);
  getSettingsMock.mockReset();
  getSettingsMock.mockResolvedValue({ aiImageEnabled: true });
});

describe("generateProductImage", () => {
  it("enqueues the placement job on the happy path", async () => {
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock).toHaveBeenCalledWith(
      "placement",
      { productId: "p1" },
      { jobId: "p1" },
    );
    expect(queueRemoveMock).toHaveBeenCalledWith("p1");
  });

  it("returns productNotFound when the row is missing", async () => {
    dbState.products = [];
    const result = await generateProductImage("ghost");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("blocks when both shop and per-product toggles are off", async () => {
    getSettingsMock.mockResolvedValue({ aiImageEnabled: false });
    dbState.products = [{ ...baseProduct, aiImageEnabled: null }];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("blocks when per-product override is explicitly off (even with shop on)", async () => {
    getSettingsMock.mockResolvedValue({ aiImageEnabled: true });
    dbState.products = [{ ...baseProduct, aiImageEnabled: false }];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("allows per-product override of true when shop is off", async () => {
    getSettingsMock.mockResolvedValue({ aiImageEnabled: false });
    dbState.products = [{ ...baseProduct, aiImageEnabled: true }];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });

  it("blocks when aiModelId is null", async () => {
    dbState.products = [{ ...baseProduct, aiModelId: null }];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("blocks when clothingType is null", async () => {
    dbState.products = [{ ...baseProduct, clothingType: null }];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("blocks when no ai_reference image exists", async () => {
    dbState.aiReferenceRows = [];
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(false);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("skips enqueue (idempotent) when the latest run already succeeded", async () => {
    latestRunForKindMock.mockResolvedValue({ status: "succeeded" });
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(true);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("re-enqueues a succeeded run when force=true", async () => {
    latestRunForKindMock.mockResolvedValue({ status: "succeeded" });
    const result = await generateProductImage("p1", { force: true });
    expect(result.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });

  it("clears stale failed ai_runs rows before re-enqueueing", async () => {
    latestRunForKindMock.mockResolvedValue({ status: "failed" });
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(true);
    expect(dbState.deleteCalls).toBeGreaterThanOrEqual(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });

  it("tolerates queue.remove() failures (stale jobId / active job race)", async () => {
    queueRemoveMock.mockRejectedValueOnce(new Error("job is active"));
    const result = await generateProductImage("p1");
    expect(result.ok).toBe(true);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
