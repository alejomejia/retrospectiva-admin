// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const openaiCreateMock = vi.fn();

vi.mock("@/lib/integrations/openai/client", () => ({
  openai: {
    responses: { create: openaiCreateMock },
  },
  MODELS: {
    text: "gpt-5",
    translate: "gpt-4o-mini",
    image: "gpt-image-2",
  },
  isReasoningModel: (m: string) => /^(gpt-5|o[134])/.test(m),
  reasoningParams: (m: string, effort = "minimal") =>
    /^(gpt-5|o[134])/.test(m) ? { reasoning: { effort } } : {},
}));

type DbProductRow = {
  id: string;
  clothingType: string | null;
  condition: string | null;
  size: string | null;
  basePriceCents: number | null;
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  riseCm: number | null;
  legCm: number | null;
  lengthCm: number | null;
  braSize: string | null;
  titleEs?: string | null;
};

const dbState: {
  rows: DbProductRow[];
  images: Array<{ r2Key: string }>;
  updateCalls: Array<{ values: Record<string, unknown> }>;
  aiRunInsertCount: number;
  aiRunUpdateCalls: Array<{ values: Record<string, unknown> }>;
} = {
  rows: [],
  images: [],
  updateCalls: [],
  aiRunInsertCount: 0,
  aiRunUpdateCalls: [],
};

vi.mock("@/lib/db/client", () => {
  // Distinguishing the two tables by drizzle's internal `_.name` is
  // unreliable across versions. The enrich path only writes to two
  // tables, and the value shapes are mutually exclusive:
  //   - `ai_runs` updates always set `status` to one of the
  //     ai-run-status enum values.
  //   - `products` updates in this code path never set `status`.
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
    values: (_values: Record<string, unknown>) => ({
      returning: async () => {
        dbState.aiRunInsertCount += 1;
        return [{ id: `run-${dbState.aiRunInsertCount}` }];
      },
    }),
  });
  // The product query is `select().from(products).where().limit()`.
  // The image query is `select({ r2Key }).from(images).where().orderBy().limit()`.
  // The `orderBy().limit()` chain returns `dbState.images`; the
  // direct `.limit()` returns `dbState.rows`.
  const select = () => ({
    from: () => ({
      where: () => ({
        limit: async () => dbState.rows,
        orderBy: () => ({
          limit: async () => dbState.images,
        }),
      }),
    }),
  });
  return { db: { update, insert, select } };
});

vi.mock("@/lib/utils/dev", () => ({
  devGroup: () => ({
    log: () => {},
    warn: () => {},
    error: () => {},
  }),
  devLog: () => {},
  devWarn: () => {},
  devError: () => {},
}));

const { runEnrichment } = await import("./enrich");

const baseRow: DbProductRow = {
  id: "p1",
  clothingType: "dress",
  condition: "very_good",
  size: "M",
  basePriceCents: 4500,
  shoulderCm: 40,
  chestCm: 46,
  waistCm: 38,
  hipCm: 48,
  riseCm: null,
  legCm: null,
  lengthCm: 120,
  braSize: null,
};

const validOutput = {
  titleEs: "Vestido azul de los 80 con flores",
  descriptionEs:
    "Un vestido vintage de los 80 con estampado floral. Combínalo con botas blancas para un look retro inconfundible.",
  etsyTagsEs: ["vestido", "vintage"],
  etsyMaterialsEs: ["algodon"],
  etsyWhenMade: "1980s",
  etsyPrimaryColor: "blue",
  etsySecondaryColor: null,
};

beforeEach(() => {
  dbState.rows = [baseRow];
  dbState.images = [{ r2Key: "products/2026/05/17/p1/original/abc.jpg" }];
  dbState.updateCalls = [];
  dbState.aiRunInsertCount = 0;
  dbState.aiRunUpdateCalls = [];
  openaiCreateMock.mockReset();
});

describe("runEnrichment", () => {
  it("parses a valid Responses payload and writes the AI fields to the row", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_test",
      output_text: JSON.stringify(validOutput),
      usage: { input_tokens: 1200, output_tokens: 400 },
    });

    await runEnrichment("p1");

    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    const call = openaiCreateMock.mock.calls[0]![0];
    expect(call.model).toBe("gpt-5");
    expect(call.text.format.type).toBe("json_schema");

    // Cost-optimization knob: minimal reasoning.
    expect(call.reasoning?.effort).toBe("minimal");

    // The product photo is attached as `input_image` so the model
    // grounds its description in what's actually visible.
    const userMsg = call.input.find(
      (m: { role: string }) => m.role === "user",
    );
    const imageBlock = userMsg.content.find(
      (c: { type: string }) => c.type === "input_image",
    );
    expect(imageBlock).toBeDefined();
    expect(imageBlock.detail).toBe("low");

    // Compacted user-text JSON: no null measurement keys.
    const textBlock = userMsg.content.find(
      (c: { type: string }) => c.type === "input_text",
    );
    const sent = JSON.parse(textBlock.text);
    expect(sent.measurements.riseCm).toBeUndefined();
    expect(sent.measurements.legCm).toBeUndefined();

    expect(dbState.updateCalls).toHaveLength(1);
    const written = dbState.updateCalls[0]!.values;
    expect(written).toMatchObject({
      titleEs: validOutput.titleEs,
      descriptionEs: validOutput.descriptionEs,
      etsyWhenMade: "1980s",
    });
    expect(written.etsyTagsEs).toEqual(["vestido", "vintage"]);
    // `etsyTaxonomyId` is derived from `clothingType` in
    // `updateProductDraftField`, not by this enrichment path.
    expect(written.etsyTaxonomyId).toBeUndefined();

    // ai_runs: one insert (running) + one update (succeeded).
    expect(dbState.aiRunInsertCount).toBe(1);
    expect(dbState.aiRunUpdateCalls).toHaveLength(1);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "succeeded",
    });
    expect(dbState.aiRunUpdateCalls[0]!.values.costUsd).toEqual(
      expect.any(String),
    );
  });

  it("reads output_text from the structured `output` array when the SDK doesn't expose `output_text` directly", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_test",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify(validOutput) },
          ],
        },
      ],
    });
    await runEnrichment("p1");
    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]!.values).toMatchObject({
      titleEs: validOutput.titleEs,
    });
  });

  it("marks the run as failed when the model emits non-JSON output", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_test",
      output_text: "this is not JSON",
    });

    await expect(runEnrichment("p1")).rejects.toThrow();

    expect(dbState.updateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls).toHaveLength(1);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
    });
  });

  it("marks the run as failed when the JSON fails the zod schema", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_test",
      output_text: JSON.stringify({ titleEs: "Hola" }),
    });

    await expect(runEnrichment("p1")).rejects.toThrow();
    expect(dbState.updateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
    });
  });

  it("marks the run as failed when the OpenAI call itself throws", async () => {
    openaiCreateMock.mockRejectedValueOnce(new Error("OpenAI exploded"));

    await expect(runEnrichment("p1")).rejects.toThrow("OpenAI exploded");
    expect(dbState.updateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
      error: "OpenAI exploded",
    });
  });

  it("throws when the product doesn't exist", async () => {
    dbState.rows = [];
    await expect(runEnrichment("missing")).rejects.toThrow(/not found/);
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("falls back to text-only when the product has no image", async () => {
    dbState.images = [];
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_test",
      output_text: JSON.stringify(validOutput),
    });

    await runEnrichment("p1");

    const call = openaiCreateMock.mock.calls[0]![0];
    const userMsg = call.input.find(
      (m: { role: string }) => m.role === "user",
    );
    const imageBlock = userMsg.content.find(
      (c: { type: string }) => c.type === "input_image",
    );
    expect(imageBlock).toBeUndefined();
  });
});
