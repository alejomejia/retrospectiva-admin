import { randomUUID } from "node:crypto";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, sql } from "drizzle-orm";

import {
  IMAGE_QUALITY_VALUES,
  type ImageQuality,
} from "@/lib/ai-models/variables";
import { db } from "@/lib/db/client";
import {
  aiModels,
  productImages,
  products,
  type Product,
} from "@/lib/db/schema";
import { R2_BUCKET, R2_PUBLIC_BASE_URL, r2 } from "@/lib/integrations/r2/client";
import {
  generateImageKey,
  publicUrlFor,
} from "@/lib/integrations/r2/keys";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { getProductSettings } from "@/lib/products/settings";
import { devGroup } from "@/lib/utils/dev";

import { completeRun, failRun, startRun } from "./ai-runs-log";
import { MODELS, openai } from "./client";
import {
  assembleImagePlacementPrompt,
  type ImagePlacementInput,
} from "./image-placement-prompts";
import { resolveSourcePanel } from "./image-placement-prompts";
import { type PanelKey } from "./panel-keys";
import { estimateImageCostUsd, logImageCallUsage } from "./responses-helpers";
import {
  AI_ENVIRONMENT_PRESETS,
  AI_FIT_OVERRIDES,
  AI_FRAMING_PRESETS,
  AI_POSE_PRESETS,
  type AiEnvironmentPreset,
  type AiFitOverride,
  type AiFramingPreset,
  type AiPosePreset,
} from "@/lib/products/draft-schema";

const dev = devGroup("openai.image-placement");

/** Portrait, largest gpt-image-2 portrait. Etsy wants ≥2000px on the
 *  long edge; the worker will eventually post-upscale via sharp (see
 *  Phase 2 §13). Tracked alongside the doc. */
const IMAGE_SIZE = "1024x1536";
/** Fallback for legacy rows whose `ai_image_quality` text doesn't
 *  match the validated enum (shouldn't happen given the column
 *  default, but defensive). The operator's per-product pick on the
 *  AiImageSection drives the actual call. */
const DEFAULT_IMAGE_QUALITY: ImageQuality = "low";

/** Map `PanelKey` → the `ai_models` column that carries the R2 key. */
const PANEL_TO_KEY_COLUMN: Record<
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
 * Full image-placement pass for one product. Resolves the model
 * panel + AI-reference image, assembles the 8-block prompt, calls
 * `openai.images.edit` with both attachments, hard-deletes any
 * prior `ai_model`-role row for the product, then inserts the
 * fresh one.
 *
 * Pre-flight gating (shop + per-product AI-image toggle, model +
 * reference present) is duplicated from the action layer as
 * defense-in-depth: any caller of this function must be safe to
 * invoke without burning an OpenAI call when the toggle is off.
 *
 * Throws on hard failures. The worker catches + reports via
 * `ai_runs` and the activity feed.
 */
export async function runImagePlacement(productId: string): Promise<void> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new Error(`runImagePlacement: product ${productId} not found`);
  }

  // Defense-in-depth: short-circuit when either toggle resolves to
  // off. The action layer also checks this; doing it here means a
  // direct queue.add() (REPL, future migration) can't burn an
  // OpenAI call against the user's intent.
  const settings = await getProductSettings();
  const aiImageOn = product.aiImageEnabled ?? settings.aiImageEnabled;
  if (!aiImageOn) {
    dev.log("skip · ai image disabled (shop+per-product gate)", productId);
    return;
  }

  if (product.aiModelId === null) {
    throw new Error(
      `runImagePlacement: product ${productId} has no aiModelId`,
    );
  }
  if (product.clothingType === null) {
    throw new Error(
      `runImagePlacement: product ${productId} has no clothingType`,
    );
  }

  const [model] = await db
    .select()
    .from(aiModels)
    .where(eq(aiModels.id, product.aiModelId))
    .limit(1);
  if (!model) {
    throw new Error(
      `runImagePlacement: ai_models row ${product.aiModelId} not found`,
    );
  }

  const [reference] = await db
    .select()
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "ai_reference"),
      ),
    )
    .limit(1);
  if (!reference) {
    throw new Error(
      `runImagePlacement: product ${productId} has no ai_reference image`,
    );
  }

  const panel = resolveSourcePanel(
    product.clothingType,
    product.aiSourcePanel as PanelKey | null,
  );
  const panelKey = model.cropsAvailable
    ? model[PANEL_TO_KEY_COLUMN[panel]]
    : model.contactSheetKey;
  if (!panelKey) {
    throw new Error(
      `runImagePlacement: model ${model.id} has no R2 key for panel "${panel}"`,
    );
  }

  const promptInput: ImagePlacementInput = {
    clothingType: product.clothingType,
    fitOverride: coerceFitOverride(product.aiFitOverride),
    posePreset: coercePose(product.aiPosePreset),
    framingPreset: coerceFraming(product.aiFramingPreset),
    environmentPreset: coerceEnvironment(product.aiEnvironmentPreset),
  };
  const prompt = assembleImagePlacementPrompt(promptInput);

  // DB column is `text` (validation lives at the zod boundary);
  // narrow here so the OpenAI call gets the strict union and any
  // malformed legacy value falls back to the default rather than
  // crashing the run.
  const quality: ImageQuality = (
    IMAGE_QUALITY_VALUES as readonly string[]
  ).includes(product.aiImageQuality)
    ? (product.aiImageQuality as ImageQuality)
    : DEFAULT_IMAGE_QUALITY;
  maybeLogAssembledPrompt({
    productId,
    panel,
    aiModelId: model.id,
    input: promptInput,
    quality,
    prompt,
  });

  const runId = await startRun({
    productId,
    kind: "model_placement",
    model: MODELS.image,
    input: {
      prompt,
      size: IMAGE_SIZE,
      quality,
      aiModelId: model.id,
      panel,
      aiReferenceKey: reference.r2Key,
    },
  });

  try {
    const [panelBytes, referenceBytes] = await Promise.all([
      downloadR2Bytes(panelKey),
      downloadR2Bytes(reference.r2Key),
    ]);

    // gpt-image-2's images.edit takes one or many input images; we
    // attach identity panel first (so the model anchors on the face),
    // garment reference second.
    const panelFile = bytesToFile(panelBytes, "panel.png", "image/png");
    const refFile = bytesToFile(
      referenceBytes,
      "reference" + extFromR2Key(reference.r2Key),
      mimeFromR2Key(reference.r2Key),
    );

    const response = await openai.images.edit({
      model: MODELS.image,
      image: [panelFile, refFile],
      prompt,
      size: IMAGE_SIZE,
      quality,
      n: 1,
    });

    logImageCallUsage({
      kind: "model_placement",
      model: MODELS.image,
      size: IMAGE_SIZE,
      quality,
    });

    const outputBytes = await extractFirstImage(response);

    // Hard-delete any prior ai_model row (DB + R2) so the listing
    // never shows stale generated imagery. Best-effort R2 delete;
    // an orphan there is recoverable via the sale-time prefix sweep.
    const priorAiModels = await db
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, productId),
          eq(productImages.role, "ai_model"),
        ),
      );
    for (const prev of priorAiModels) {
      try {
        await r2.send(
          new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: prev.r2Key }),
        );
      } catch (err) {
        dev.error("prior ai_model R2 delete failed:", err);
      }
      await db.delete(productImages).where(eq(productImages.id, prev.id));
    }

    const outKey = generateImageKey({
      productId,
      createdAt: product.createdAt,
      role: "ai_model",
      uuid: randomUUID(),
      extension: "png",
    });
    await uploadToR2({
      key: outKey,
      body: outputBytes,
      contentType: "image/png",
    });

    const nextOrder = await nextAiModelOrder(productId);
    const [inserted] = await db
      .insert(productImages)
      .values({
        productId,
        r2Key: outKey,
        role: "ai_model",
        order: nextOrder,
      })
      .returning({ id: productImages.id });

    await db
      .update(products)
      .set({ updatedAt: sql`now()` })
      .where(eq(products.id, productId));

    await completeRun({
      id: runId,
      output: {
        r2Key: outKey,
        productImageId: inserted?.id ?? null,
        url: publicUrlFor(outKey, R2_PUBLIC_BASE_URL),
      },
      costUsd: estimateImageCostUsd({
        model: MODELS.image,
        size: IMAGE_SIZE,
        quality,
      }),
    });

    dev.log("placement succeeded", productId, outKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await failRun({ id: runId, error: msg });
    dev.error("placement failed", productId, msg);
    throw err;
  }
}

// ----- Prompt dump (opt-in) ----------------------------------------

/**
 * Truthy values for `LOG_IMAGE_PLACEMENT_PROMPT`. Anything else
 * (unset, `"0"`, `"false"`, empty) leaves logging off.
 */
const TRUTHY_ENV = new Set(["1", "true", "yes", "on"]);

/**
 * When `LOG_IMAGE_PLACEMENT_PROMPT` is truthy, prints the assembled
 * prompt + the inputs that produced it to stdout. Verbose on purpose
 * — gives the operator a one-stop receipt that the UI selects map to
 * the exact text we send to `gpt-image-2`, without re-deriving from
 * the snapshot tests.
 *
 * Worker code uses `console.log` directly per the queue/worker.ts
 * convention (devLog no-ops in prod, which would render this dump
 * silent exactly when ops want it visible).
 */
function maybeLogAssembledPrompt(payload: {
  productId: string;
  panel: PanelKey;
  aiModelId: string;
  input: ImagePlacementInput;
  quality: ImageQuality;
  prompt: string;
}): void {
  const flag = process.env.LOG_IMAGE_PLACEMENT_PROMPT;
  if (!flag || !TRUTHY_ENV.has(flag.trim().toLowerCase())) return;
  const header =
    `--- [ai-image-placement prompt] product=${payload.productId} ` +
    `model=${payload.aiModelId} panel=${payload.panel} ` +
    `clothingType=${payload.input.clothingType} ` +
    `pose=${payload.input.posePreset} ` +
    `framing=${payload.input.framingPreset} ` +
    `env=${payload.input.environmentPreset} ` +
    `fit=${payload.input.fitOverride ?? "none"} ` +
    `quality=${payload.quality} ---`;
  console.log(`${header}\n${payload.prompt}\n--- [/prompt] ---`);
}

// ----- Helpers -----------------------------------------------------

async function downloadR2Bytes(r2Key: string): Promise<Buffer> {
  const url = publicUrlFor(r2Key, R2_PUBLIC_BASE_URL);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `R2 download failed for ${r2Key}: HTTP ${res.status} ${res.statusText}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

function bytesToFile(
  bytes: Buffer,
  filename: string,
  mimeType: string,
): File {
  // OpenAI SDK uses the global File constructor for multipart uploads.
  return new File([new Uint8Array(bytes)], filename, { type: mimeType });
}

function extFromR2Key(key: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(key);
  return m ? `.${m[1]!.toLowerCase()}` : "";
}

function mimeFromR2Key(key: string): string {
  const ext = extFromR2Key(key).slice(1);
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

async function nextAiModelOrder(productId: string): Promise<number> {
  const rows = await db
    .select({ order: productImages.order })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "ai_model"),
      ),
    );
  if (rows.length === 0) return 0;
  return Math.max(...rows.map((r) => r.order)) + 1;
}

async function extractFirstImage(response: unknown): Promise<Buffer> {
  const r = response as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = r.data?.[0];
  if (!first) throw new Error("images.edit returned no data[]");
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
    "images.edit response had neither b64_json nor url on data[0]",
  );
}

// ----- Stored-string coercion --------------------------------------
//
// DB columns are `text` (per `docs/per-product-image-gen.md` "Schema":
// validation lives at the zod boundary so prompt iteration doesn't
// require a migration). These helpers narrow to the typed enum here
// at the worker boundary so the prompt builder gets concrete unions.

function coercePose(value: string): AiPosePreset {
  return (AI_POSE_PRESETS as readonly string[]).includes(value)
    ? (value as AiPosePreset)
    : "soft_relaxed";
}

function coerceFraming(value: string): AiFramingPreset {
  return (AI_FRAMING_PRESETS as readonly string[]).includes(value)
    ? (value as AiFramingPreset)
    : "waist_up";
}

function coerceEnvironment(value: string): AiEnvironmentPreset {
  return (AI_ENVIRONMENT_PRESETS as readonly string[]).includes(value)
    ? (value as AiEnvironmentPreset)
    : "textured_wall";
}

function coerceFitOverride(value: string | null): AiFitOverride | null {
  if (value === null) return null;
  return (AI_FIT_OVERRIDES as readonly string[]).includes(value)
    ? (value as AiFitOverride)
    : null;
}

// `Product` is re-exported here so the action layer can share the
// narrowed type when constructing log payloads, without a second
// import path. Keep the symbol used to avoid an unused-import warning
// in editors that don't see the type-only usage above.
export type _ProductRef = Product;
