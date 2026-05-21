// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const imagesGenerateMock = vi.fn();

vi.mock("@/lib/integrations/openai/client", () => ({
  openai: {
    images: { generate: imagesGenerateMock },
  },
  MODELS: {
    text: "gpt-5",
    translate: "gpt-4o-mini",
    image: "gpt-image-2",
  },
}));

const uploadToR2Mock = vi.fn();
vi.mock("@/lib/integrations/r2/upload", () => ({
  uploadToR2: uploadToR2Mock,
}));

const cropPanelsMock = vi.fn();
vi.mock("@/lib/integrations/openai/grid-crop", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/integrations/openai/grid-crop")
  >("@/lib/integrations/openai/grid-crop");
  return {
    ...actual,
    cropPanelsFromSheet: cropPanelsMock,
  };
});

type ModelRow = {
  id: string;
  ageRange: string;
  bodyType: string;
  heightRange: string;
  skinTone: string;
  faceShape: string;
  hairColor: string;
  hairShape: string;
  hairType: string;
  imageQuality: string;
};

const dbState: {
  rows: ModelRow[];
  updateCalls: Array<{ values: Record<string, unknown> }>;
  aiRunInsertCount: number;
  aiRunUpdateCalls: Array<{ values: Record<string, unknown> }>;
} = {
  rows: [],
  updateCalls: [],
  aiRunInsertCount: 0,
  aiRunUpdateCalls: [],
};

vi.mock("@/lib/db/client", () => {
  const AI_RUN_STATUSES = new Set([
    "pending",
    "running",
    "succeeded",
    "failed",
  ]);
  const isAiRunsUpdate = (values: Record<string, unknown>) =>
    typeof values.status === "string" &&
    AI_RUN_STATUSES.has(values.status);
  const update = (_table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        if (isAiRunsUpdate(values)) {
          dbState.aiRunUpdateCalls.push({ values });
        } else {
          dbState.updateCalls.push({ values });
        }
        return Promise.resolve();
      },
    }),
  });
  const insert = (_table: unknown) => ({
    values: () => ({
      returning: async () => {
        dbState.aiRunInsertCount += 1;
        return [{ id: `run-${dbState.aiRunInsertCount}` }];
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
  return { db: { update, insert, select } };
});

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({ log: () => {}, warn: () => {}, error: () => {} }),
}));

const { runModelGeneration } = await import("./model-generate");

const baseRow: ModelRow = {
  id: "m1",
  ageRange: "woman in her late 20s",
  bodyType: "athletic",
  heightRange: "170cm",
  skinTone: "fair skin",
  faceShape: "oval",
  hairColor: "dark brown",
  hairShape: "low ponytail",
  hairType: "straight",
  imageQuality: "low",
};

beforeEach(() => {
  dbState.rows = [{ ...baseRow }];
  dbState.updateCalls = [];
  dbState.aiRunInsertCount = 0;
  dbState.aiRunUpdateCalls = [];
  imagesGenerateMock.mockReset();
  uploadToR2Mock.mockReset();
  uploadToR2Mock.mockImplementation(({ key }: { key: string }) => key);
  cropPanelsMock.mockReset();
});

describe("runModelGeneration", () => {
  it("interpolates the 7 vars verbatim into the prompt and calls gpt-image-2", async () => {
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });
    cropPanelsMock.mockResolvedValueOnce({
      front_full: Buffer.from("p1"),
      front_portrait: Buffer.from("p2"),
      front_editorial: Buffer.from("p3"),
      side_portrait: Buffer.from("p4"),
      back_full: Buffer.from("p5"),
      threequarter_full: Buffer.from("p6"),
    });

    await runModelGeneration("m1");

    expect(imagesGenerateMock).toHaveBeenCalledTimes(1);
    const call = imagesGenerateMock.mock.calls[0]![0];
    expect(call.model).toBe("gpt-image-2");
    expect(call.size).toBe("1536x1024");
    expect(call.quality).toBe("low");
    expect(call.n).toBe(1);

    // Every variable should appear verbatim in the prompt — no token
    // accidentally swallowed.
    expect(call.prompt).toContain("woman in her late 20s");
    expect(call.prompt).toContain("european");
    expect(call.prompt).toContain("athletic");
    expect(call.prompt).toContain("170cm");
    expect(call.prompt).toContain("fair skin");
    expect(call.prompt).toContain("oval");
    expect(call.prompt).toContain("dark brown");
    expect(call.prompt).toContain("low ponytail");
    expect(call.prompt).toContain("straight");
    // No unfilled placeholders.
    expect(call.prompt).not.toMatch(/\{[A-Z_]+\}/);
  });

  it("uploads the contact sheet + all 6 panels and writes all 7 R2 keys to the row", async () => {
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });
    cropPanelsMock.mockResolvedValueOnce({
      front_full: Buffer.from("p1"),
      front_portrait: Buffer.from("p2"),
      front_editorial: Buffer.from("p3"),
      side_portrait: Buffer.from("p4"),
      back_full: Buffer.from("p5"),
      threequarter_full: Buffer.from("p6"),
    });

    await runModelGeneration("m1");

    // 1 sheet + 6 panels = 7 R2 uploads.
    expect(uploadToR2Mock).toHaveBeenCalledTimes(7);
    const keys = uploadToR2Mock.mock.calls.map((c) => c[0]?.key);
    expect(keys).toEqual([
      "assets/models/m1/run-1/contact-sheet.png",
      "assets/models/m1/run-1/front_full.png",
      "assets/models/m1/run-1/front_portrait.png",
      "assets/models/m1/run-1/front_editorial.png",
      "assets/models/m1/run-1/side_portrait.png",
      "assets/models/m1/run-1/back_full.png",
      "assets/models/m1/run-1/threequarter_full.png",
    ]);

    // Row update carries every key + crops_available=true.
    const update = dbState.updateCalls[0]!.values;
    expect(update).toMatchObject({
      contactSheetKey: "assets/models/m1/run-1/contact-sheet.png",
      frontFullKey: "assets/models/m1/run-1/front_full.png",
      frontPortraitKey: "assets/models/m1/run-1/front_portrait.png",
      frontEditorialKey: "assets/models/m1/run-1/front_editorial.png",
      sidePortraitKey: "assets/models/m1/run-1/side_portrait.png",
      backFullKey: "assets/models/m1/run-1/back_full.png",
      threequarterFullKey: "assets/models/m1/run-1/threequarter_full.png",
      cropsAvailable: true,
    });
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "succeeded",
    });
  });

  it("falls back to sheet-only when gutter detection returns null", async () => {
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });
    cropPanelsMock.mockResolvedValueOnce(null);

    await runModelGeneration("m1");

    // Only the contact sheet uploaded; no panel uploads.
    expect(uploadToR2Mock).toHaveBeenCalledTimes(1);
    expect(uploadToR2Mock.mock.calls[0]![0].key).toBe(
      "assets/models/m1/run-1/contact-sheet.png",
    );

    const update = dbState.updateCalls[0]!.values;
    expect(update).toMatchObject({
      contactSheetKey: "assets/models/m1/run-1/contact-sheet.png",
      cropsAvailable: false,
    });
    expect(update.frontFullKey).toBeUndefined();
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "succeeded",
    });
  });

  it("downloads the image via fetch when the SDK returns a URL instead of b64_json", async () => {
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ url: "https://example.test/img.png" }],
    });
    cropPanelsMock.mockResolvedValueOnce(null);

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          status: 200,
        }),
      );

    await runModelGeneration("m1");

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/img.png");
    expect(uploadToR2Mock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("marks the run as failed when the OpenAI call throws", async () => {
    imagesGenerateMock.mockRejectedValueOnce(
      new Error("OpenAI image-gen exploded"),
    );

    await expect(runModelGeneration("m1")).rejects.toThrow(
      "OpenAI image-gen exploded",
    );
    expect(uploadToR2Mock).not.toHaveBeenCalled();
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
      error: "OpenAI image-gen exploded",
    });
  });

  it("honors per-row image_quality (e.g. 'high' override)", async () => {
    dbState.rows = [{ ...baseRow, imageQuality: "high" }];
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });
    cropPanelsMock.mockResolvedValueOnce(null);

    await runModelGeneration("m1");

    const call = imagesGenerateMock.mock.calls[0]![0];
    expect(call.quality).toBe("high");
  });

  it("falls back to 'low' when the row's image_quality value is unrecognized", async () => {
    dbState.rows = [{ ...baseRow, imageQuality: "garbage" }];
    imagesGenerateMock.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("fake-png").toString("base64") }],
    });
    cropPanelsMock.mockResolvedValueOnce(null);

    await runModelGeneration("m1");

    const call = imagesGenerateMock.mock.calls[0]![0];
    expect(call.quality).toBe("low");
  });

  it("throws when the model doesn't exist", async () => {
    dbState.rows = [];
    await expect(runModelGeneration("nope")).rejects.toThrow(/not found/);
    expect(imagesGenerateMock).not.toHaveBeenCalled();
  });
});
