import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import {
  ETSY_COLORS,
  type EtsyColor,
} from "@/lib/integrations/etsy/etsy-colors";
import {
  clampPhrasesToMaxLen,
  ETSY_MATERIAL_MAX_LEN,
  ETSY_TAG_MAX_LEN,
} from "@/lib/integrations/etsy/etsy-text";
import { ETSY_ERA_VALUES, type EtsyEra } from "@/lib/products/draft-schema";
import { devGroup } from "@/lib/utils/dev";

import {
  completeRun,
  failRun,
  latestSucceededEnrichInput,
  startRun,
} from "./ai-runs-log";
import { MODELS, openai } from "./client";
import { buildEnrichInputContext, primaryImageUrl } from "./enrich";
import { BRAND_VOICE, ENRICH_SYSTEM } from "./prompts";
import {
  estimateCostUsd,
  extractOutputText,
  logCacheUsage,
} from "./responses-helpers";

const dev = devGroup("openai.regenerate-field");

/**
 * The five AI-populated columns the user can independently regenerate
 * from step 2. The Etsy taxonomy id is derived server-side from
 * `clothingType` (see `getEtsyTaxonomyForClothingType`) — the model
 * never picks a category, so it's not a regenerable field.
 */
export const REGENERABLE_FIELDS = [
  "titleEs",
  "descriptionEs",
  "etsyTagsEs",
  "etsyMaterialsEs",
  "etsyWhenMade",
  "etsyPrimaryColor",
  "etsySecondaryColor",
] as const;

export type RegenerableField = (typeof REGENERABLE_FIELDS)[number];

export type RegeneratedValue =
  | { field: "titleEs"; value: string }
  | { field: "descriptionEs"; value: string }
  | { field: "etsyTagsEs"; value: string[] }
  | { field: "etsyMaterialsEs"; value: string[] }
  | { field: "etsyWhenMade"; value: EtsyEra }
  | { field: "etsyPrimaryColor"; value: EtsyColor }
  | { field: "etsySecondaryColor"; value: EtsyColor | null };

/**
 * Per-field regeneration. One Responses-API call returns ONLY the
 * requested field; the result overwrites that one column and logs to
 * `ai_runs` under `kind='field_regenerate'`.
 *
 * Input strategy: the model's grounding context is replayed from the
 * cached `inputJson` of the latest succeeded enrich run. If no prior
 * succeeded enrich exists (edge case — user hits regenerate on a
 * field before the first full enrich finished), we rebuild from the
 * current `products` row using the same compact() shape.
 *
 * The request body is intentionally identical in shape to enrichment
 * (same system prompt + brand voice + compact JSON input + product
 * image) except for the output schema, which constrains the model to
 * a single property. This keeps the model's behavior consistent with
 * the original generation — only the surface area being regenerated
 * is different.
 *
 * Throws on hard failure (no row, OpenAI error, schema mismatch). The
 * caller logs + surfaces a toast.
 */
export async function regenerateField(
  productId: string,
  field: RegenerableField,
): Promise<RegeneratedValue> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`regenerateField: product ${productId} not found`);
  }

  // Replay the cached enrichment input when available; rebuild from
  // the product row only as a fallback. The cache path is the one we
  // care about: it costs zero extra DB work to assemble the prompt +
  // matches what the original generation saw.
  const cachedInput = await latestSucceededEnrichInput(productId);
  const inputContext = cachedInput ?? buildEnrichInputContext(product);
  const imageUrl = await primaryImageUrl(productId);

  const runId = await startRun({
    productId,
    kind: "field_regenerate",
    model: MODELS.text,
    input: { field, context: inputContext, imageUrl },
  });

  try {
    const userContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "low" | "high" | "auto" }
    > = [{ type: "input_text", text: JSON.stringify(inputContext) }];
    if (imageUrl) {
      userContent.push({
        type: "input_image",
        image_url: imageUrl,
        detail: "low",
      });
    }

    const response = await openai.responses.create({
      model: MODELS.text,
      input: [
        {
          role: "system",
          content: `${ENRICH_SYSTEM}\n\n${BRAND_VOICE}\n\nRegenera SOLO el campo "${field}". Devuelve un objeto JSON con esa única propiedad.`,
        },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "FieldRegenerationOutput",
          strict: true,
          schema: schemaForField(field),
        },
      },
      reasoning: { effort: "minimal" },
      // Reasoning models draw hidden reasoning tokens from this budget.
      // A single field is small, but nano still needs headroom or it
      // returns `incomplete (reason: max_output_tokens)`. See enrich.ts.
      max_output_tokens: 2048,
    });

    logCacheUsage({ kind: "field_regenerate", model: MODELS.text, response });

    const text = extractOutputText(response);
    const value = parseFieldValue(field, text);

    // Single-column write. We intentionally do NOT bump `updatedAt`
    // here: the parent step-2 view keys `AiContentSection` on
    // `product.updatedAt` and a remount would discard the in-progress
    // user edits on the other fields.
    await db
      .update(products)
      .set({ [field]: value } as Partial<typeof products.$inferInsert>)
      .where(eq(products.id, productId));

    await completeRun({
      id: runId,
      output: { [field]: value },
      costUsd: estimateCostUsd(MODELS.text, response),
    });

    dev.log(`field-regenerate succeeded`, productId, field);
    return { field, value } as RegeneratedValue;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun({ id: runId, error: msg });
    dev.error(`field-regenerate failed`, productId, field, msg);
    throw err;
  }
}

/**
 * Build a single-field JSON Schema mirroring the relevant slice of
 * `EnrichmentOutput`. `strict: true` + `additionalProperties: false`
 * forces the model to emit ONLY the requested property — no smuggling
 * in unrequested fields.
 */
function schemaForField(field: RegenerableField) {
  const property = (() => {
    switch (field) {
      case "titleEs":
        return { type: "string", minLength: 10, maxLength: 140 };
      case "descriptionEs":
        return { type: "string", minLength: 40, maxLength: 2000 };
      case "etsyTagsEs":
        return {
          type: "array",
          maxItems: 13,
          items: { type: "string", minLength: 1, maxLength: 20 },
        };
      case "etsyMaterialsEs":
        return {
          type: "array",
          maxItems: 13,
          items: { type: "string", minLength: 1, maxLength: 45 },
        };
      case "etsyWhenMade":
        return { type: "string", enum: [...ETSY_ERA_VALUES] };
      case "etsyPrimaryColor":
        return { type: "string", enum: [...ETSY_COLORS] };
      case "etsySecondaryColor":
        return { type: ["string", "null"], enum: [...ETSY_COLORS, null] };
    }
  })();
  return {
    type: "object",
    additionalProperties: false,
    properties: { [field]: property },
    required: [field],
  };
}

function parseFieldValue(
  field: RegenerableField,
  text: string,
): RegeneratedValue["value"] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Model output was not valid JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Model output was not a JSON object");
  }
  const value = (parsed as Record<string, unknown>)[field];
  switch (field) {
    case "titleEs":
    case "descriptionEs":
      if (typeof value !== "string") {
        throw new Error(`${field} value was not a string`);
      }
      return value;
    case "etsyTagsEs":
    case "etsyMaterialsEs":
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        throw new Error(`${field} value was not a string array`);
      }
      // Clamp to the Etsy per-entry cap (structured outputs ignore
      // JSON-Schema maxLength) so a regenerated phrase repairs rather
      // than persisting an over-length tag/material.
      return clampPhrasesToMaxLen(
        value as string[],
        field === "etsyTagsEs" ? ETSY_TAG_MAX_LEN : ETSY_MATERIAL_MAX_LEN,
      );
    case "etsyWhenMade":
      if (
        typeof value !== "string" ||
        !ETSY_ERA_VALUES.includes(value as EtsyEra)
      ) {
        throw new Error(`${field} value was not a valid Etsy era`);
      }
      return value as EtsyEra;
    case "etsyPrimaryColor":
      if (
        typeof value !== "string" ||
        !ETSY_COLORS.includes(value as EtsyColor)
      ) {
        throw new Error(`${field} value was not a valid Etsy color`);
      }
      return value as EtsyColor;
    case "etsySecondaryColor":
      if (value === null) return null;
      if (
        typeof value !== "string" ||
        !ETSY_COLORS.includes(value as EtsyColor)
      ) {
        throw new Error(`${field} value was not a valid Etsy color or null`);
      }
      return value as EtsyColor;
  }
}
