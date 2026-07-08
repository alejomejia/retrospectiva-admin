// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  sizes: string[];
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  riseCm: number | null;
  legCm: number | null;
  lengthCm: number | null;
  braSize: string | null;
  comments: string | null;
};

const dbState: {
  rows: DbProductRow[];
  images: Array<{ r2Key: string }>;
  cachedInputJson: Record<string, unknown> | null;
  productUpdateCalls: Array<{ values: Record<string, unknown> }>;
  aiRunInserts: Array<{ values: Record<string, unknown> }>;
  aiRunUpdateCalls: Array<{ values: Record<string, unknown> }>;
} = {
  rows: [],
  images: [],
  cachedInputJson: null,
  productUpdateCalls: [],
  aiRunInserts: [],
  aiRunUpdateCalls: [],
};

// Mirrors enrich.test.ts — distinguish ai_runs writes from products
// writes by the presence of a status field on the values payload.
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
          dbState.productUpdateCalls.push({ values });
        }
        return Promise.resolve();
      },
    }),
  });
  const insert = (_table: unknown) => ({
    values: (values: Record<string, unknown>) => ({
      returning: async () => {
        dbState.aiRunInserts.push({ values });
        return [{ id: `run-${dbState.aiRunInserts.length}` }];
      },
    }),
  });

  // Three select shapes to disambiguate:
  //   - product:     select().from().where().limit()              → rows
  //   - image:       select({...}).from().where().orderBy().limit() → images
  //   - cached input: select({inputJson}).from().where().orderBy().limit() → cachedInputJson
  //
  // Distinguish image vs. cached-input selects by which fields the
  // caller projects: image projection picks `r2Key`, cached-input
  // picks `inputJson`.
  const select = (projection?: Record<string, unknown>) => {
    const isInputJsonSelect =
      projection !== undefined && "inputJson" in projection;
    return {
      from: () => ({
        where: () => ({
          limit: async () => dbState.rows,
          orderBy: () => ({
            limit: async () =>
              isInputJsonSelect
                ? dbState.cachedInputJson
                  ? [{ inputJson: dbState.cachedInputJson }]
                  : []
                : dbState.images,
          }),
        }),
      }),
    };
  };

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

const { regenerateField } = await import("./regenerate-field");

const baseRow: DbProductRow = {
  id: "p1",
  clothingType: "dress",
  condition: "very_good",
  sizes: ["m"],
  shoulderCm: 40,
  chestCm: 46,
  waistCm: 38,
  hipCm: 48,
  riseCm: null,
  legCm: null,
  lengthCm: 120,
  braSize: null,
  comments: "Sello cosido a mano, tela suave",
};

// The cached input is what the ORIGINAL enrich run sent to OpenAI.
// Per-field regenerate MUST send exactly this (not a freshly built
// snapshot), to keep cost predictable and replay the original
// grounding context.
const cachedInput = {
  clothingType: "dress",
  condition: "very_good",
  sizes: ["m"],
  measurements: { shoulderCm: 40, chestCm: 46, waistCm: 38, hipCm: 48, lengthCm: 120 },
  comments: "Sello cosido a mano, tela suave",
};

beforeEach(() => {
  dbState.rows = [baseRow];
  dbState.images = [{ r2Key: "products/2026/05/17/p1/original/abc.jpg" }];
  dbState.cachedInputJson = cachedInput;
  dbState.productUpdateCalls = [];
  dbState.aiRunInserts = [];
  dbState.aiRunUpdateCalls = [];
  openaiCreateMock.mockReset();
});

describe("regenerateField", () => {
  it("replays the cached enrich input — does NOT rebuild from the (possibly user-edited) product row", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ titleEn: "80s floral dress" }),
      usage: { input_tokens: 800, output_tokens: 30 },
    });

    // Mutate the product row in a user-visible way that should NOT
    // leak into the OpenAI call when a cached input exists.
    dbState.rows = [
      { ...baseRow, comments: "tweaked by the user after enrich" },
    ];

    await regenerateField("p1", "titleEn");

    const call = openaiCreateMock.mock.calls[0]![0];
    const userMsg = call.input.find(
      (m: { role: string }) => m.role === "user",
    );
    const textBlock = userMsg.content.find(
      (c: { type: string }) => c.type === "input_text",
    );
    const sent = JSON.parse(textBlock.text);

    // EXACT equality: the request body matches the cached input
    // byte-for-byte. No extra fields slipped in, no user mutations
    // bled through.
    expect(sent).toEqual(cachedInput);
  });

  it("sends a JSON Schema constrained to ONLY the requested field", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ descriptionEn: "x".repeat(60) }),
      usage: { input_tokens: 800, output_tokens: 200 },
    });

    await regenerateField("p1", "descriptionEn");

    const call = openaiCreateMock.mock.calls[0]![0];
    expect(call.text.format.type).toBe("json_schema");
    expect(call.text.format.strict).toBe(true);
    expect(Object.keys(call.text.format.schema.properties)).toEqual([
      "descriptionEn",
    ]);
    expect(call.text.format.schema.required).toEqual(["descriptionEn"]);
    expect(call.text.format.schema.additionalProperties).toBe(false);
  });

  it("for `etsyTagsEn`, sends an array schema and asks for ONLY that field", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ etsyTagsEn: ["vintage", "dress"] }),
      usage: { input_tokens: 800, output_tokens: 30 },
    });

    await regenerateField("p1", "etsyTagsEn");

    const call = openaiCreateMock.mock.calls[0]![0];
    const props = call.text.format.schema.properties;
    expect(Object.keys(props)).toEqual(["etsyTagsEn"]);
    expect(props.etsyTagsEn.type).toBe("array");
  });

  it("writes ONLY the requested column on the products row", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ titleEn: "Vintage 80s dress" }),
      usage: { input_tokens: 800, output_tokens: 30 },
    });

    await regenerateField("p1", "titleEn");

    expect(dbState.productUpdateCalls).toHaveLength(1);
    const written = dbState.productUpdateCalls[0]!.values;
    expect(Object.keys(written)).toEqual(["titleEn"]);
    expect(written.titleEn).toBe("Vintage 80s dress");
    // updatedAt must NOT be bumped — bumping triggers a remount of
    // AiContentSection in the parent and discards in-progress user
    // edits on the other fields.
    expect(written.updatedAt).toBeUndefined();
  });

  it("logs the run under kind='field_regenerate' (not 'enrich')", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ titleEn: "Vintage style dress" }),
      usage: { input_tokens: 800, output_tokens: 30 },
    });

    await regenerateField("p1", "titleEn");

    expect(dbState.aiRunInserts).toHaveLength(1);
    expect(dbState.aiRunInserts[0]!.values.kind).toBe("field_regenerate");
    // The audit row records WHICH field was regenerated and the
    // replayed context — so we can trace per-field cost over time.
    const input = dbState.aiRunInserts[0]!.values.inputJson as {
      field: string;
      context: unknown;
    };
    expect(input.field).toBe("titleEn");
    expect(input.context).toEqual(cachedInput);
    expect(dbState.aiRunUpdateCalls[0]!.values.status).toBe("succeeded");
  });

  it("falls back to building input from the product row when no cached enrich exists", async () => {
    dbState.cachedInputJson = null;
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      output_text: JSON.stringify({ titleEn: "80s floral dress" }),
      usage: { input_tokens: 800, output_tokens: 30 },
    });

    await regenerateField("p1", "titleEn");

    const call = openaiCreateMock.mock.calls[0]![0];
    const userMsg = call.input.find(
      (m: { role: string }) => m.role === "user",
    );
    const sent = JSON.parse(
      userMsg.content.find((c: { type: string }) => c.type === "input_text")
        .text,
    );
    // Fresh build: matches the compacted shape (null measurements stripped).
    expect(sent.clothingType).toBe("dress");
    expect(sent.comments).toBe("Sello cosido a mano, tela suave");
    expect(sent.measurements.riseCm).toBeUndefined();
    expect(sent.measurements.legCm).toBeUndefined();
  });

  it("marks the run as failed when the model returns a value that doesn't match the field type", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      id: "resp_1",
      // Model returned a wrong-shape value for an array field.
      output_text: JSON.stringify({ etsyTagsEn: "vintage" }),
    });

    await expect(regenerateField("p1", "etsyTagsEn")).rejects.toThrow();
    expect(dbState.productUpdateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values.status).toBe("failed");
  });

  it("marks the run as failed when OpenAI throws", async () => {
    openaiCreateMock.mockRejectedValueOnce(new Error("OpenAI exploded"));

    await expect(regenerateField("p1", "titleEn")).rejects.toThrow(
      "OpenAI exploded",
    );
    expect(dbState.productUpdateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
      error: "OpenAI exploded",
    });
  });
});
