import { eq, sql } from "drizzle-orm";

import {
  IMAGE_QUALITY_VALUES,
  type ImageQuality,
} from "@/lib/ai-models/variables";
import { db } from "@/lib/db/client";
import { aiModels } from "@/lib/db/schema";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { devGroup } from "@/lib/utils/dev";

import { completeRun, failRun, startRun } from "./ai-runs-log";
import { MODELS, openai } from "./client";
import { cropPanelsFromSheet, PANEL_ORDER, type PanelKey } from "./grid-crop";
import { BASE_MODEL_GENERATION } from "./prompts";
import { estimateImageCostUsd, logImageCallUsage } from "./responses-helpers";

const dev = devGroup("openai.model-generate");

/** Landscape, 3:2 aspect — matches the 3×2 panel grid. */
const IMAGE_SIZE = "1536x1024";
/** Default when the row doesn't carry an explicit `image_quality`
 *  (rows from before the column existed). `low` is cheap (~$0.016/call);
 *  the operator can pick `medium` / `high` via the new-model form. */
const DEFAULT_IMAGE_QUALITY: ImageQuality = "low";

/**
 * R2 prefix for one generation run's output. The `runId` segment
 * guarantees every regeneration writes to a fresh path, so the
 * 1-year-immutable cache headers we set on R2 objects don't bite
 * us when the user hits Regenerar — browsers + Cloudflare's edge
 * never see two different bytes at the same URL.
 *
 * Old runs leave orphan prefixes; they get cleaned up when the
 * model is discarded (`deleteR2Prefix(assets/models/{id}/)`) or
 * via a future sweep job.
 */
function r2Prefix(modelId: string, runId: string): string {
  return `assets/models/${modelId}/${runId}`;
}

/** PNG column name → R2 key column name lookup. */
const PANEL_COLUMN: Record<
  PanelKey,
  | "frontFullKey"
  | "frontPortraitKey"
  | "frontEditorialKey"
  | "sidePortraitKey"
  | "backFullKey"
  | "threequarterFullKey"
> = {
  front_full: "frontFullKey",
  front_portrait: "frontPortraitKey",
  front_editorial: "frontEditorialKey",
  side_portrait: "sidePortraitKey",
  back_full: "backFullKey",
  threequarter_full: "threequarterFullKey",
};

/**
 * Full generation pass for one `ai_models` row. Reads the seven
 * identity vars off the row, interpolates them into the
 * `BASE_MODEL_GENERATION` prompt, calls `gpt-image-2`, uploads the
 * contact sheet + cropped panels to R2, and updates the row with
 * the R2 keys + `crops_available` flag.
 *
 * If gutter detection fails (`grid-crop.ts` returns null), the
 * contact sheet is stored alone and `crops_available=false` — the
 * row stays usable; Phase 2 can fall back to the full sheet.
 *
 * Throws on hard failures (no row, OpenAI error, upload error). The
 * worker wrapping this catches + reports via `ai_runs` + the
 * activity feed.
 */
export async function runModelGeneration(modelId: string): Promise<void> {
  const [row] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.id, modelId))
    .limit(1);
  if (!row) {
    throw new Error(`runModelGeneration: model ${modelId} not found`);
  }

  const prompt = interpolatePrompt(BASE_MODEL_GENERATION, {
    AGE_RANGE: row.ageRange,
    BODY_TYPE: row.bodyType,
    HEIGHT_RANGE: row.heightRange,
    SKIN_TONE: row.skinTone,
    FACE_SHAPE: row.faceShape,
    HAIR_COLOR: row.hairColor,
    HAIR_SHAPE: row.hairShape,
    HAIR_TYPE: row.hairType,
  });

  // DB column is `text` (validation lives at the zod boundary);
  // narrow here so the OpenAI call gets the strict union and any
  // malformed legacy value falls back to the default rather than
  // crashing the run.
  const quality: ImageQuality = (
    IMAGE_QUALITY_VALUES as readonly string[]
  ).includes(row.imageQuality)
    ? (row.imageQuality as ImageQuality)
    : DEFAULT_IMAGE_QUALITY;

  const runId = await startRun({
    aiModelId: modelId,
    kind: "model_generation",
    model: MODELS.image,
    input: { prompt, size: IMAGE_SIZE, quality },
  });

  try {
    const response = await openai.images.generate({
      model: MODELS.image,
      prompt,
      size: IMAGE_SIZE,
      quality,
      n: 1,
    });

    logImageCallUsage({
      kind: "model_generation",
      model: MODELS.image,
      size: IMAGE_SIZE,
      quality,
    });

    const sheetBytes = await extractFirstImage(response);

    // Upload the original contact sheet first — it's the canonical
    // artifact that always exists, even when crops fail.
    const sheetKey = `${r2Prefix(modelId, runId)}/contact-sheet.png`;
    await uploadToR2({
      key: sheetKey,
      body: sheetBytes,
      contentType: "image/png",
    });

    // Try to crop. Returns null when the model's output doesn't have
    // a clean 3×2 grid we can carve.
    const panels = await cropPanelsFromSheet(sheetBytes);

    const update: Partial<typeof aiModels.$inferInsert> = {
      contactSheetKey: sheetKey,
      cropsAvailable: panels !== null,
      aiRunId: runId,
      updatedAt: sql`now()` as never,
    };

    if (panels) {
      for (const panel of PANEL_ORDER) {
        const key = `${r2Prefix(modelId, runId)}/${panel}.png`;
        await uploadToR2({
          key,
          body: panels[panel],
          contentType: "image/png",
        });
        update[PANEL_COLUMN[panel]] = key;
      }
    } else {
      dev.warn(
        "crops unavailable — storing contact sheet only",
        modelId,
      );
    }

    await db.update(aiModels).set(update).where(eq(aiModels.id, modelId));

    await completeRun({
      id: runId,
      output: {
        contactSheetKey: sheetKey,
        cropsAvailable: panels !== null,
      },
      costUsd: estimateImageCostUsd({
        model: MODELS.image,
        size: IMAGE_SIZE,
        quality,
      }),
    });

    dev.log("model generation succeeded", modelId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun({ id: runId, error: msg });
    dev.error("model generation failed", modelId, msg);
    throw err;
  }
}

/** Fill `{VAR}` placeholders with values. Unmatched vars stay as
 *  literal text (cheap defense vs. typos in the template). */
function interpolatePrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{([A-Z_]+)\}/g, (match, key) =>
    typeof vars[key] === "string" ? vars[key]! : match,
  );
}

/**
 * Pull bytes out of `openai.images.generate`'s response shape.
 * The SDK returns either `data[].url` (download required) or
 * `data[].b64_json` (decode in place). Handles both for safety —
 * the model/SDK combination determines which one shows up.
 */
async function extractFirstImage(response: unknown): Promise<Buffer> {
  const r = response as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = r.data?.[0];
  if (!first) throw new Error("images.generate returned no data[]");
  if (typeof first.b64_json === "string" && first.b64_json !== "") {
    return Buffer.from(first.b64_json, "base64");
  }
  if (typeof first.url === "string" && first.url !== "") {
    const res = await fetch(first.url);
    if (!res.ok) {
      throw new Error(
        `image download failed: HTTP ${res.status} ${res.statusText}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(
    "images.generate response had neither b64_json nor url on data[0]",
  );
}
