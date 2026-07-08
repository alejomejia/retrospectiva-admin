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
}));

type DbProductRow = {
  id: string;
  titleEn: string | null;
  descriptionEn: string | null;
  etsyTagsEn: string[];
  etsyMaterialsEn: string[];
};

const dbState: {
  rows: DbProductRow[];
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
  // Same shape-based discriminator as enrich.test.ts: ai_runs updates
  // always carry `status`; products updates in the translation path
  // never do.
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
  devGroup: () => ({
    log: () => {},
    warn: () => {},
    error: () => {},
  }),
  devLog: () => {},
  devWarn: () => {},
  devError: () => {},
}));

const { runTranslation } = await import("./translate");

const baseRow: DbProductRow = {
  id: "p1",
  titleEn: "Vintage 80s dress",
  descriptionEn:
    "A vintage 80s dress with a floral print. Pair it with white boots.",
  etsyTagsEn: ["dress", "vintage", "80s"],
  etsyMaterialsEn: ["cotton", "polyester"],
};

beforeEach(() => {
  dbState.rows = [{ ...baseRow }];
  dbState.updateCalls = [];
  dbState.aiRunInsertCount = 0;
  dbState.aiRunUpdateCalls = [];
  openaiCreateMock.mockReset();
});

describe("runTranslation — string fields", () => {
  it("translates titleEn → titleEs and writes the result", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      output_text: JSON.stringify({ value: "Vestido vintage de los 80" }),
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    await runTranslation("p1", "titleEn");

    expect(openaiCreateMock).toHaveBeenCalledTimes(1);
    const call = openaiCreateMock.mock.calls[0]![0];
    expect(call.model).toBe("gpt-4o-mini");
    expect(call.text.format.type).toBe("json_schema");
    expect(call.text.format.name).toBe("TranslatedString");

    // User payload carries the EN value wrapped in { value }.
    const userMsg = call.input.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(JSON.parse(userMsg.content)).toEqual({
      value: baseRow.titleEn,
    });

    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]!.values).toEqual({
      titleEs: "Vestido vintage de los 80",
    });

    // ai_runs: one insert (running) + one update (succeeded).
    expect(dbState.aiRunInsertCount).toBe(1);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "succeeded",
    });
  });

  it("translates descriptionEn the same way", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        value: "Un bonito vestido vintage de los 80.",
      }),
    });
    await runTranslation("p1", "descriptionEn");
    expect(dbState.updateCalls[0]!.values).toEqual({
      descriptionEs: "Un bonito vestido vintage de los 80.",
    });
  });

  it("clears the ES column to null when the source string is empty (no API call)", async () => {
    dbState.rows = [{ ...baseRow, titleEn: "" }];
    await runTranslation("p1", "titleEn");
    expect(openaiCreateMock).not.toHaveBeenCalled();
    expect(dbState.updateCalls).toEqual([{ values: { titleEs: null } }]);
    // No ai_runs row for a no-op clear.
    expect(dbState.aiRunInsertCount).toBe(0);
  });
});

describe("runTranslation — array fields", () => {
  it("translates etsyTagsEn item-by-item, preserving the order", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        items: ["vestido", "vintage", "años 80"],
      }),
    });
    await runTranslation("p1", "etsyTagsEn");

    const call = openaiCreateMock.mock.calls[0]![0];
    expect(call.text.format.name).toBe("TranslatedArray");

    expect(dbState.updateCalls).toHaveLength(1);
    expect(dbState.updateCalls[0]!.values).toEqual({
      etsyTagsEs: ["vestido", "vintage", "años 80"],
    });
  });

  it("clears the ES column to [] when the source array is empty (no API call)", async () => {
    dbState.rows = [{ ...baseRow, etsyTagsEn: [] }];
    await runTranslation("p1", "etsyTagsEn");
    expect(openaiCreateMock).not.toHaveBeenCalled();
    expect(dbState.updateCalls).toEqual([{ values: { etsyTagsEs: [] } }]);
  });

  it("rejects the run when the translated array length drifts from the source", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        items: ["vestido", "vintage"], // 2 != 3
      }),
    });
    await expect(
      runTranslation("p1", "etsyTagsEn"),
    ).rejects.toThrow(/length drift/);
    // No product write, but the run is recorded as failed.
    expect(dbState.updateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
    });
  });
});

describe("runTranslation — failure paths", () => {
  it("marks the run as failed when the model emits non-JSON output", async () => {
    openaiCreateMock.mockResolvedValueOnce({
      output_text: "this is not JSON",
    });
    await expect(runTranslation("p1", "titleEn")).rejects.toThrow();
    expect(dbState.updateCalls).toHaveLength(0);
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
    });
  });

  it("marks the run as failed when the OpenAI call itself throws", async () => {
    openaiCreateMock.mockRejectedValueOnce(new Error("OpenAI exploded"));
    await expect(runTranslation("p1", "titleEn")).rejects.toThrow(
      "OpenAI exploded",
    );
    expect(dbState.aiRunUpdateCalls[0]!.values).toMatchObject({
      status: "failed",
      error: "OpenAI exploded",
    });
  });

  it("throws when the product doesn't exist", async () => {
    dbState.rows = [];
    await expect(runTranslation("missing", "titleEn")).rejects.toThrow(
      /not found/,
    );
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });
});
