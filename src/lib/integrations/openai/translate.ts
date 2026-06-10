import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products, type Product } from "@/lib/db/schema";
import {
  clampPhrasesToMaxLen,
  ETSY_MATERIAL_MAX_LEN,
  ETSY_TAG_MAX_LEN,
} from "@/lib/integrations/etsy/etsy-text";
import { devGroup } from "@/lib/utils/dev";

import { completeRun, failRun, startRun } from "./ai-runs-log";
import { MODELS, openai } from "./client";
import { TRANSLATE_ES_EN } from "./prompts";
import {
  estimateCostUsd,
  extractOutputText,
  logCacheUsage,
} from "./responses-helpers";

const dev = devGroup("openai.translate");

/**
 * The four ES product columns that the Etsy-publish processor
 * translates to their EN counterparts before pushing the listing.
 * Translations live entirely at the publish boundary — the admin
 * UI only edits Spanish; the EN columns are a cache of what we
 * last sent to Etsy.
 */
export const TRANSLATABLE_FIELDS = [
  "titleEs",
  "descriptionEs",
  "etsyTagsEs",
  "etsyMaterialsEs",
] as const;

export type TranslatableField = (typeof TRANSLATABLE_FIELDS)[number];

/** ES → EN column name. Single source of truth for the field map. */
const TARGET_COLUMN: Record<
  TranslatableField,
  "titleEn" | "descriptionEn" | "etsyTagsEn" | "etsyMaterialsEn"
> = {
  titleEs: "titleEn",
  descriptionEs: "descriptionEn",
  etsyTagsEs: "etsyTagsEn",
  etsyMaterialsEs: "etsyMaterialsEn",
};

/** Structured-output schemas. Two shapes only — strings and arrays
 *  of strings — so two schemas cover all four fields. Wrapped in an
 *  object root because the Responses API requires an object schema. */
const STRING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { value: { type: "string" } },
  required: ["value"],
} as const;

const ARRAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["items"],
} as const;

/**
 * Translate one ES field of a product to EN. Reads the current ES
 * value from the DB, calls gpt-4o-mini via the Responses API with a
 * structured-output schema, and writes the EN value back.
 *
 * Empty source → clears the EN target (null for strings, [] for
 * arrays). Treated as a successful run; no API call is made.
 *
 * Throws on hard failures (no row, OpenAI error, schema mismatch).
 * Callers (the Phase 4c publish processor) wrap with their own
 * error handling so a single failed field doesn't void the listing.
 */
export async function runTranslation(
  productId: string,
  field: TranslatableField,
): Promise<void> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`runTranslation: product ${productId} not found`);
  }

  const sourceValue = product[field as keyof Product];
  const isArrayField = Array.isArray(sourceValue);
  const isEmpty = isEmptySource(sourceValue);

  // Empty source short-circuits with a direct DB write. The EN
  // counterpart should always mirror the ES presence — a cleared ES
  // field means the EN side stops "carrying" the previous value.
  if (isEmpty) {
    await db
      .update(products)
      .set({ [TARGET_COLUMN[field]]: isArrayField ? [] : null })
      .where(eq(products.id, productId));
    dev.log("translation cleared (empty source)", productId, field);
    return;
  }

  const runId = await startRun({
    productId,
    kind: "translation",
    model: MODELS.translate,
    input: { field, value: sourceValue },
  });

  try {
    const userPayload = isArrayField
      ? JSON.stringify({ items: sourceValue })
      : JSON.stringify({ value: sourceValue });

    const response = await openai.responses.create({
      model: MODELS.translate,
      input: [
        { role: "system", content: TRANSLATE_ES_EN },
        { role: "user", content: userPayload },
      ],
      text: {
        format: {
          type: "json_schema",
          name: isArrayField ? "TranslatedArray" : "TranslatedString",
          strict: true,
          schema: isArrayField ? ARRAY_SCHEMA : STRING_SCHEMA,
        },
      },
    });

    logCacheUsage({ kind: "translation", model: MODELS.translate, response });

    const text = extractOutputText(response);
    const parsed = safeJsonParse(text);

    const translated = isArrayField
      ? clampTranslatedArray(
          field,
          parseTranslatedArray(parsed, (sourceValue as string[]).length),
        )
      : parseTranslatedString(parsed);

    await db
      .update(products)
      .set({ [TARGET_COLUMN[field]]: translated })
      .where(eq(products.id, productId));

    await completeRun({
      id: runId,
      output: { field, translated },
      costUsd: estimateCostUsd(MODELS.translate, response),
    });

    dev.log("translation succeeded", productId, field);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun({ id: runId, error: msg });
    dev.error("translation failed", productId, field, msg);
    throw err;
  }
}

/**
 * Translate a single ES string to EN, returning the result without
 * touching the DB. Used for the per-product listing-footer override,
 * whose EN counterpart is cached at save time rather than living in a
 * translatable product column. Empty input short-circuits to "".
 *
 * Throws on OpenAI errors or a malformed response so the caller can
 * surface the failure (the footer-override save aborts rather than
 * caching a stale/empty translation).
 */
export async function translateText(text: string): Promise<string> {
  const source = text.trim();
  if (!source) return "";

  const response = await openai.responses.create({
    model: MODELS.translate,
    input: [
      { role: "system", content: TRANSLATE_ES_EN },
      { role: "user", content: JSON.stringify({ value: source }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "TranslatedString",
        strict: true,
        schema: STRING_SCHEMA,
      },
    },
  });

  logCacheUsage({ kind: "translation", model: MODELS.translate, response });

  return parseTranslatedString(safeJsonParse(extractOutputText(response)));
}

/**
 * Clamp a translated tag/material array to the Etsy per-entry cap. The
 * cap applies in every locale, and the translator can lengthen a phrase
 * (an EN rendering may run longer than its ES source), so the EN side is
 * clamped here rather than relying on the listing mapper to drop the
 * over-length entries it would otherwise discard.
 */
function clampTranslatedArray(
  field: TranslatableField,
  translated: string[],
): string[] {
  if (field === "etsyTagsEs") {
    return clampPhrasesToMaxLen(translated, ETSY_TAG_MAX_LEN);
  }
  if (field === "etsyMaterialsEs") {
    return clampPhrasesToMaxLen(translated, ETSY_MATERIAL_MAX_LEN);
  }
  return translated;
}

function isEmptySource(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function parseTranslatedString(parsed: unknown): string {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "value" in parsed &&
    typeof (parsed as { value: unknown }).value === "string"
  ) {
    return (parsed as { value: string }).value;
  }
  throw new Error("translation output missing string `value`");
}

function parseTranslatedArray(
  parsed: unknown,
  expectedLength: number,
): string[] {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "items" in parsed &&
    Array.isArray((parsed as { items: unknown }).items)
  ) {
    const arr = (parsed as { items: unknown[] }).items;
    if (arr.length !== expectedLength) {
      throw new Error(
        `translation array length drift — expected ${expectedLength}, got ${arr.length}`,
      );
    }
    return arr.map((item) => {
      if (typeof item !== "string") {
        throw new Error("translation array contained non-string item");
      }
      return item;
    });
  }
  throw new Error("translation output missing array `items`");
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(
      `Model output was not valid JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
}
