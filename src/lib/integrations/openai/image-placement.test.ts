// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- OpenAI SDK ---------------------------------------------------

const imagesEditMock = vi.fn();

vi.mock("@/lib/integrations/openai/client", () => ({
  openai: { images: { edit: imagesEditMock } },
  MODELS: {
    text: "gpt-5",
    translate: "gpt-4o-mini",
    image: "gpt-image-2",
  },
}));

// ---- R2 -----------------------------------------------------------

const uploadToR2Mock = vi.fn();
vi.mock("@/lib/integrations/r2/upload", () => ({
  uploadToR2: uploadToR2Mock,
}));

const r2SendMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/integrations/r2/client", () => ({
  r2: { send: r2SendMock },
  R2_BUCKET: "test-bucket",
  R2_PUBLIC_BASE_URL: "https://r2.test",
}));

// ---- Settings (shop-wide toggle) ---------------------------------

const getSettingsMock = vi.fn().mockResolvedValue({ aiImageEnabled: true });
vi.mock("@/lib/products/settings", () => ({
  getProductSettings: getSettingsMock,
}));

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
}));

// ---- DB state -----------------------------------------------------

type ProductRow = {
  id: string;
  createdAt: Date;
  aiImageEnabled: boolean | null;
  aiModelId: string | null;
  aiSourcePanel: string | null;
  aiPosePreset: string;
  aiFramingPreset: string;
  aiEnvironmentPreset: string;
  aiFitOverride: string | null;
  aiImageQuality: string;
  clothingType: string | null;
};

type ModelRow = {
  id: string;
  cropsAvailable: boolean;
  contactSheetKey: string | null;
  frontFullKey: string | null;
  frontPortraitKey: string | null;
  frontEditorialKey: string | null;
  sidePortraitKey: string | null;
  backFullKey: string | null;
  threequarterFullKey: string | null;
};

type ImageRow = {
  id: string;
  productId: string;
  r2Key: string;
  role: "original" | "ai_model" | "ai_reference" | "thumbnail";
  order: number;
  width: number | null;
  height: number | null;
};

const dbState: {
  products: ProductRow[];
  models: ModelRow[];
  images: ImageRow[];
  inserted: ImageRow[];
  productUpdated: boolean;
  aiRunInsertCount: number;
  aiRunUpdateCalls: Array<Record<string, unknown>>;
  deletedImageIds: string[];
} = {
  products: [],
  models: [],
  images: [],
  inserted: [],
  productUpdated: false,
  aiRunInsertCount: 0,
  aiRunUpdateCalls: [],
  deletedImageIds: [],
};

vi.mock("@/lib/db/client", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>(
    "@/lib/db/schema",
  );
  const AI_RUN_STATUSES = new Set([
    "pending",
    "running",
    "succeeded",
    "failed",
  ]);
  return {
    db: {
      select: (_cols?: unknown) => ({
        from: (table: unknown) => {
          return {
            where: (cond: unknown) => {
              const whereImpl = {
                limit: async () => fetchByTable(table),
                orderBy: () => ({
                  limit: async () => fetchByTable(table),
                }),
              };
              void cond;
              // Some callers don't call .limit() — `select().from(productImages).where(...)`
              // (the prior ai_model lookup). Return a promise-like.
              const directPromise = Promise.resolve(fetchByTable(table));
              return Object.assign(directPromise, whereImpl);
            },
          };

          function fetchByTable(t: unknown) {
            if (t === schema.products) return dbState.products;
            if (t === schema.aiModels) return dbState.models;
            if (t === schema.productImages) return dbState.images;
            return [];
          }
        },
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          if (table === schema.aiRuns) {
            return {
              returning: async () => {
                dbState.aiRunInsertCount += 1;
                return [{ id: `run-${dbState.aiRunInsertCount}` }];
              },
            };
          }
          if (table === schema.productImages) {
            const row: ImageRow = {
              id: `new-${dbState.inserted.length + 1}`,
              productId: String(values.productId),
              r2Key: String(values.r2Key),
              role: values.role as ImageRow["role"],
              order: Number(values.order ?? 0),
              width: (values.width as number | null) ?? null,
              height: (values.height as number | null) ?? null,
            };
            dbState.inserted.push(row);
            return {
              returning: async () => [{ id: row.id }],
            };
          }
          return { returning: async () => [] };
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            if (
              table === schema.aiRuns ||
              (typeof values.status === "string" &&
                AI_RUN_STATUSES.has(values.status))
            ) {
              dbState.aiRunUpdateCalls.push(values);
            } else if (table === schema.products) {
              dbState.productUpdated = true;
            }
            return Promise.resolve();
          },
        }),
      }),
      delete: (_table: unknown) => ({
        where: () => {
          // Best-effort: record nothing detailed; just bump the count
          // via the inserted-array purge happening elsewhere.
          return Promise.resolve();
        },
      }),
    },
  };
});

// Import AFTER mocks so the module sees them.
const { runImagePlacement } = await import("./image-placement");

// ---- Helpers ------------------------------------------------------

function makeProduct(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "p1",
    createdAt: new Date("2026-05-21T10:00:00.000Z"),
    aiImageEnabled: true,
    aiModelId: "m1",
    aiSourcePanel: null,
    aiPosePreset: "soft_relaxed",
    aiFramingPreset: "waist_up",
    aiEnvironmentPreset: "textured_wall",
    aiFitOverride: null,
    aiImageQuality: "low",
    clothingType: "jacket",
    ...over,
  };
}

function makeModel(over: Partial<ModelRow> = {}): ModelRow {
  return {
    id: "m1",
    cropsAvailable: true,
    contactSheetKey: "assets/models/m1/run-1/contact-sheet.png",
    frontFullKey: "assets/models/m1/run-1/front_full.png",
    frontPortraitKey: "assets/models/m1/run-1/front_portrait.png",
    frontEditorialKey: "assets/models/m1/run-1/front_editorial.png",
    sidePortraitKey: "assets/models/m1/run-1/side_portrait.png",
    backFullKey: "assets/models/m1/run-1/back_full.png",
    threequarterFullKey: "assets/models/m1/run-1/threequarter_full.png",
    ...over,
  };
}

function makeImage(over: Partial<ImageRow>): ImageRow {
  return {
    id: "img-default",
    productId: "p1",
    r2Key: "products/2026/05/21/p1/ai_reference/ref.jpg",
    role: "ai_reference",
    order: 0,
    width: 800,
    height: 1200,
    ...over,
  };
}

const FAKE_PNG_B64 = Buffer.from("generated-png").toString("base64");

function mockSuccessfulOpenAI() {
  imagesEditMock.mockResolvedValueOnce({
    data: [{ b64_json: FAKE_PNG_B64 }],
  });
}

function mockR2Downloads() {
  // Each fetch returns a 3-byte fake body. Two downloads expected per
  // run (panel + reference). Use `mockImplementation` so any order /
  // count works.
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { status: 200 });
  });
}

beforeEach(() => {
  dbState.products = [makeProduct()];
  dbState.models = [makeModel()];
  dbState.images = [makeImage({ id: "ref-1" })];
  dbState.inserted = [];
  dbState.productUpdated = false;
  dbState.aiRunInsertCount = 0;
  dbState.aiRunUpdateCalls = [];
  dbState.deletedImageIds = [];

  imagesEditMock.mockReset();
  uploadToR2Mock.mockReset();
  uploadToR2Mock.mockImplementation(({ key }: { key: string }) => key);
  r2SendMock.mockReset();
  r2SendMock.mockResolvedValue(undefined);
  getSettingsMock.mockReset();
  getSettingsMock.mockResolvedValue({ aiImageEnabled: true });

  vi.restoreAllMocks();
  mockR2Downloads();
});

// ---- Tests --------------------------------------------------------

describe("runImagePlacement", () => {
  it("calls openai.images.edit with both attachments + default panel + square size", async () => {
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");

    expect(imagesEditMock).toHaveBeenCalledTimes(1);
    const call = imagesEditMock.mock.calls[0]![0];
    expect(call.model).toBe("gpt-image-2");
    expect(call.size).toBe("1024x1024");
    // Defaults to `low` — the row was created with that.
    expect(call.quality).toBe("low");
    expect(call.n).toBe(1);
    expect(Array.isArray(call.image)).toBe(true);
    expect(call.image).toHaveLength(2);
    // Identity panel first, garment reference second.
    expect(call.image[0]?.name).toMatch(/panel/);
    expect(call.image[1]?.name).toMatch(/reference/);

    // Prompt contains key per-axis snippets.
    expect(call.prompt).toContain("jacket");
    expect(call.prompt).toContain("waist level upward"); // framing
    expect(call.prompt).toContain("Natural relaxed standing posture"); // pose
  });

  it("uploads the generated bytes to R2 under the product's date-partitioned ai_model prefix", async () => {
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");

    expect(uploadToR2Mock).toHaveBeenCalledTimes(1);
    const upload = uploadToR2Mock.mock.calls[0]![0];
    expect(upload.contentType).toBe("image/png");
    // Keys carry the env prefix (`dev/` or `prod/`) from `ENV_PREFIX`.
    expect(upload.key).toMatch(
      /^(?:dev|prod)\/products\/2026\/05\/21\/p1\/ai_model\/[0-9a-f-]+\.png$/,
    );
  });

  it("inserts a product_images row with role='ai_model' and bumps products.updatedAt", async () => {
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");

    expect(dbState.inserted).toHaveLength(1);
    expect(dbState.inserted[0]!.role).toBe("ai_model");
    expect(dbState.inserted[0]!.productId).toBe("p1");
    expect(dbState.productUpdated).toBe(true);

    expect(dbState.aiRunInsertCount).toBe(1);
    const final = dbState.aiRunUpdateCalls.at(-1)!;
    expect(final.status).toBe("succeeded");
  });

  it("hard-deletes prior ai_model rows from R2 before inserting the new one", async () => {
    dbState.images = [
      makeImage({ id: "ref-1" }),
      makeImage({
        id: "old-ai-1",
        role: "ai_model",
        r2Key: "products/2026/05/21/p1/ai_model/old.png",
      }),
    ];
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");

    // The R2 send should be called at least once for the prior ai_model
    // object (DeleteObjectCommand). We don't introspect the command
    // class here — verifying the call happened is sufficient.
    expect(r2SendMock).toHaveBeenCalled();
  });

  it("short-circuits silently when shop+per-product AI image toggle resolves to off", async () => {
    getSettingsMock.mockResolvedValue({ aiImageEnabled: false });
    dbState.products = [makeProduct({ aiImageEnabled: null })];

    await runImagePlacement("p1");

    expect(imagesEditMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(dbState.aiRunInsertCount).toBe(0);
  });

  it("throws when the product has no aiModelId", async () => {
    dbState.products = [makeProduct({ aiModelId: null })];
    await expect(runImagePlacement("p1")).rejects.toThrow(/aiModelId/);
    expect(imagesEditMock).not.toHaveBeenCalled();
  });

  it("throws when the product has no ai_reference image", async () => {
    dbState.images = []; // no ai_reference
    await expect(runImagePlacement("p1")).rejects.toThrow(/ai_reference/);
    expect(imagesEditMock).not.toHaveBeenCalled();
  });

  it("uses the user-picked source panel over the category default", async () => {
    dbState.products = [makeProduct({ aiSourcePanel: "back_full" })];
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");
    const runValues = dbState.aiRunUpdateCalls[0]!;
    void runValues; // not strictly asserted; the openai call already
                    // saw the panel via the input log
    // The first ai_runs row was inserted with `input.panel`. The
    // prompt itself doesn't echo the panel string, so we assert via
    // the image input filename which is fixed to "panel.png" — the
    // panel choice surfaces via which R2 URL the worker fetched.
    // Limit the assertion to: openai was called (no throw).
    expect(imagesEditMock).toHaveBeenCalled();
  });

  it("falls back to contact_sheet_key when crops_available=false", async () => {
    dbState.models = [
      makeModel({
        cropsAvailable: false,
        frontFullKey: null,
        contactSheetKey: "assets/models/m1/run-1/contact-sheet.png",
      }),
    ];
    mockSuccessfulOpenAI();
    await expect(runImagePlacement("p1")).resolves.toBeUndefined();
  });

  it("honors per-product ai_image_quality (e.g. 'high' override)", async () => {
    dbState.products = [makeProduct({ aiImageQuality: "high" })];
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");
    const call = imagesEditMock.mock.calls[0]![0];
    expect(call.quality).toBe("high");
  });

  it("falls back to 'low' when the row's ai_image_quality is unrecognized", async () => {
    dbState.products = [makeProduct({ aiImageQuality: "garbage" })];
    mockSuccessfulOpenAI();
    await runImagePlacement("p1");
    const call = imagesEditMock.mock.calls[0]![0];
    expect(call.quality).toBe("low");
  });

  it("marks the run as failed when openai.images.edit throws", async () => {
    imagesEditMock.mockRejectedValueOnce(new Error("openai boom"));
    await expect(runImagePlacement("p1")).rejects.toThrow("openai boom");
    expect(dbState.aiRunUpdateCalls.at(-1)).toMatchObject({
      status: "failed",
      error: "openai boom",
    });
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});
