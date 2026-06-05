import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { type Product, productImages, products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

import { ETSY_COLORS } from "@/lib/integrations/etsy/etsy-colors";

import { completeRun, failRun, startRun } from "./ai-runs-log";
import { MODELS, openai } from "./client";
import { BRAND_VOICE, ENRICH_SYSTEM } from "./prompts";
import {
  estimateCostUsd,
  extractOutputText,
  logCacheUsage,
} from "./responses-helpers";
import { EnrichmentOutput } from "./schemas";

/**
 * Compact input context the model uses to ground its output. Shared
 * between the full enrichment pass and per-field regeneration so both
 * calls describe the same product to the model. Persisted on the
 * `ai_runs.inputJson` audit row, which the per-field path replays
 * instead of rebuilding from the (potentially user-edited) product row.
 */
export type EnrichInputContext = {
  clothingType?: string | null;
  condition?: string | null;
  size?: string | null;
  measurements?: Record<string, unknown>;
  comments?: string | null;
};

/**
 * Build the compact context object the enrichment prompt uses. Strips
 * nulls + empty objects so `{ riseCm: null, legCm: null, … }` doesn't
 * burn tokens for garments where those measurements are absent.
 */
export function buildEnrichInputContext(
  product: Pick<
    Product,
    | "clothingType"
    | "condition"
    | "size"
    | "shoulderCm"
    | "sleeveWidthCm"
    | "sleeveLengthCm"
    | "chestCm"
    | "waistCm"
    | "hipCm"
    | "riseCm"
    | "legCm"
    | "lengthCm"
    | "braSize"
    | "comments"
  >,
): EnrichInputContext {
  return compact({
    clothingType: product.clothingType,
    condition: product.condition,
    size: product.size,
    measurements: compact({
      shoulderCm: product.shoulderCm,
      sleeveWidthCm: product.sleeveWidthCm,
      sleeveLengthCm: product.sleeveLengthCm,
      chestCm: product.chestCm,
      waistCm: product.waistCm,
      hipCm: product.hipCm,
      riseCm: product.riseCm,
      legCm: product.legCm,
      lengthCm: product.lengthCm,
      braSize: product.braSize,
    }),
    comments: product.comments?.trim() || null,
  }) as EnrichInputContext;
}

/**
 * URL of the product's primary `original` image (lowest order). The
 * enrichment + per-field regen calls both attach this as `input_image`
 * so the model can ground its output in what's actually visible.
 */
export async function primaryImageUrl(
  productId: string,
): Promise<string | null> {
  const [primaryImage] = await db
    .select({ r2Key: productImages.r2Key })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "original"),
      ),
    )
    .orderBy(productImages.order)
    .limit(1);
  return primaryImage
    ? `${R2_PUBLIC_BASE_URL}/${primaryImage.r2Key}`
    : null;
}

const dev = devGroup("openai.enrich");

/** Hard cap on output tokens. Generous enough for a max-size title +
 *  description + 13 tags + 13 materials + era + key, conservative
 *  enough that a runaway generation can't dump $1 of output. */
const MAX_OUTPUT_TOKENS = 1500;

/** Public base URL for R2 images. Read here (not via `config`) to
 *  keep this file usable from the BullMQ worker — see
 *  `docs/project-conventions.md` §1. */
const R2_PUBLIC_BASE_URL =
  process.env.R2_PUBLIC_BASE_URL ?? "http://localhost:9000";

/**
 * Full enrichment pass for a single product. One Responses-API call
 * with the structured-output schema returns Spanish title +
 * description + tags + materials + era + taxonomy key in one go.
 * The result is persisted on `products` and the call is logged to
 * `ai_runs`.
 *
 * Cost shape (per call, approx):
 *   - System prompt + brand voice ≈ 220 tokens
 *   - User text (compacted JSON) ≈ 40-80 tokens
 *   - First product image ≈ 765 tokens (low detail) / 1100+ (high)
 *   - Reasoning ≈ 200-400 tokens (we ask for "minimal")
 *   - Output ≈ 400-800 tokens (capped at MAX_OUTPUT_TOKENS)
 *
 * Throws on hard failure (no row, OpenAI error, schema mismatch).
 * The worker wrapping this catches + reports.
 */
export async function runEnrichment(productId: string): Promise<void> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`runEnrichment: product ${productId} not found`);
  }

  const imageUrl = await primaryImageUrl(productId);
  if (!imageUrl) {
    dev.warn(
      `enrichment running text-only — no original image for ${productId}`,
    );
  }
  const inputContext = buildEnrichInputContext(product);

  const runId = await startRun({
    productId,
    kind: "enrich",
    model: MODELS.text,
    input: { ...inputContext, imageUrl },
  });

  try {
    const userContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "low" | "high" | "auto" }
    > = [
      { type: "input_text", text: JSON.stringify(inputContext) },
    ];
    if (imageUrl) {
      // `detail: "low"` keeps the image cost at ~85 tokens vs 765+ on
      // "high". The model still gets enough signal to describe a
      // garment in a photo; high-detail is overkill for this task.
      userContent.push({
        type: "input_image",
        image_url: imageUrl,
        detail: "low",
      });
    }

    const response = await openai.responses.create({
      model: MODELS.text,
      input: [
        // One combined system message — saves a role-overhead chunk
        // compared to two separate system entries.
        {
          role: "system",
          content: `${ENRICH_SYSTEM}\n\n${BRAND_VOICE}`,
        },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "EnrichmentOutput",
          strict: true,
          schema: ENRICHMENT_JSON_SCHEMA,
        },
      },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      // The Responses API ignores `reasoning` on non-reasoning models,
      // so it's safe to send unconditionally. For the gpt-5 family
      // "minimal" cuts the invisible-but-billed reasoning step to its
      // floor — easily the biggest single cost lever for a task this
      // mechanical.
      reasoning: { effort: "minimal" },
    });

    logCacheUsage({ kind: "enrich", model: MODELS.text, response });

    const text = extractOutputText(response);
    const parsed = EnrichmentOutput.safeParse(safeJsonParse(text));
    if (!parsed.success) {
      const summary = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join(" · ");
      throw new Error(`EnrichmentOutput zod failed — ${summary}`);
    }
    const enrichment = parsed.data;

    // `etsyTaxonomyId` is NOT written here — it's derived from
    // `clothingType` in `updateProductDraftField` at the time the
    // user picks the garment in step 1. The AI step doesn't pick a
    // category.
    await db
      .update(products)
      .set({
        titleEs: enrichment.titleEs,
        descriptionEs: enrichment.descriptionEs,
        etsyTagsEs: enrichment.etsyTagsEs,
        etsyMaterialsEs: enrichment.etsyMaterialsEs,
        etsyWhenMade: enrichment.etsyWhenMade,
        etsyPrimaryColor: enrichment.etsyPrimaryColor,
        etsySecondaryColor: enrichment.etsySecondaryColor,
        // Bump so consumers keyed on `updatedAt` (e.g. AiContentSection
        // via `key={product.updatedAt.getTime()}`) remount with fresh
        // initial values after a regenerate. Without this the row
        // changes but the prop's identity doesn't, and useState
        // initializers don't pick up new values on re-render alone.
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, productId));

    await completeRun({
      id: runId,
      output: enrichment,
      costUsd: estimateCostUsd(MODELS.text, response),
    });

    // Translation is NOT triggered here. The EN columns are populated
    // by the Phase 4c Etsy-publish processor (inline call to
    // `runTranslation` per field, just before `updateListingTranslation`).
    // The admin UI never displays EN, so paying for a translation on
    // every draft enrichment would burn tokens on products that may
    // never be published.

    dev.log("enrichment succeeded", productId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun({ id: runId, error: msg });
    dev.error("enrichment failed", productId, msg);
    throw err;
  }
}

/**
 * Hand-rolled JSON Schema mirroring `EnrichmentOutput`. We don't pull
 * a zod-to-json-schema dep — the shape is small and the structured-
 * output endpoint requires this exact shape (with `additionalProperties:
 * false` everywhere). Update both this and `schemas.ts` when fields
 * change.
 */
const ENRICHMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleEs: { type: "string", minLength: 10, maxLength: 140 },
    descriptionEs: { type: "string", minLength: 40, maxLength: 2000 },
    etsyTagsEs: {
      type: "array",
      maxItems: 13,
      items: { type: "string", minLength: 1, maxLength: 30 },
    },
    etsyMaterialsEs: {
      type: "array",
      maxItems: 13,
      items: { type: "string", minLength: 1, maxLength: 45 },
    },
    etsyWhenMade: {
      type: "string",
      enum: ["1990s", "1980s", "1970s", "1960s", "1950s", "before_1950"],
    },
    etsyPrimaryColor: {
      type: "string",
      enum: ETSY_COLORS,
    },
    etsySecondaryColor: {
      type: ["string", "null"],
      enum: [...ETSY_COLORS, null],
    },
  },
  required: [
    "titleEs",
    "descriptionEs",
    "etsyTagsEs",
    "etsyMaterialsEs",
    "etsyWhenMade",
    "etsyPrimaryColor",
    "etsySecondaryColor",
  ],
} as const;

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch (err) {
    throw new Error(
      `Model output was not valid JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
}

/**
 * Strip `null` / `undefined` / empty-object values so we don't burn
 * tokens on `{ riseCm: null, legCm: null, … }` for garments where
 * those measurements are intentionally absent.
 */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v as object).length === 0
    ) {
      continue;
    }
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

