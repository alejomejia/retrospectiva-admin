"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { IMAGE_QUALITY_VALUES } from "@/lib/ai-models/variables";
import { db } from "@/lib/db/client";
import { productSettings } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  AI_ENVIRONMENT_PRESETS,
  AI_FRAMING_PRESETS,
  AI_POSE_PRESETS,
} from "@/lib/products/draft-schema";
import { PANEL_ORDER } from "@/lib/integrations/openai/panel-keys";
import { devGroup } from "@/lib/utils/dev";
import { PRODUCT_SETTINGS_ID } from "./settings";

const dev = devGroup("products.settings");

const AiImageEnabledSchema = z.object({
  aiImageEnabled: z.boolean(),
});

export type SaveShopAiImageEnabledInput = {
  aiImageEnabled: boolean;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Persist the shop-wide AI image generation toggle on the singleton
 * `product_settings` row. Upserts so the row materializes on first
 * write — no separate seed migration needed.
 */
export async function saveShopAiImageEnabled(
  input: SaveShopAiImageEnabledInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = AiImageEnabledSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid ai image toggle input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { aiImageEnabled } = parsed.data;

  await db
    .insert(productSettings)
    .values({ id: PRODUCT_SETTINGS_ID, aiImageEnabled })
    .onConflictDoUpdate({
      target: productSettings.id,
      set: { aiImageEnabled, updatedAt: sql`now()` },
    });

  dev.log("saved shop ai image toggle", { aiImageEnabled });
  revalidatePath("/settings/products");
  return { ok: true };
}

const AiDefaultsSchema = z.object({
  aiDefaultModelId: z.string().uuid().nullable(),
  aiDefaultSourcePanel: z.enum(PANEL_ORDER).nullable(),
  aiDefaultPosePreset: z.enum(AI_POSE_PRESETS),
  aiDefaultFramingPreset: z.enum(AI_FRAMING_PRESETS),
  aiDefaultEnvironmentPreset: z.enum(AI_ENVIRONMENT_PRESETS),
  aiDefaultImageQuality: z.enum(IMAGE_QUALITY_VALUES),
});

export type SaveAiDefaultsInput = z.infer<typeof AiDefaultsSchema>;

/**
 * Persist the shop-wide AI image placement defaults on the singleton
 * `product_settings` row. Snapshotted onto new drafts by
 * `createDraftProduct`; existing products keep whatever they were
 * created with (no cascade).
 */
export async function saveAiDefaults(
  input: SaveAiDefaultsInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = AiDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid ai defaults input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const data = parsed.data;

  await db
    .insert(productSettings)
    .values({ id: PRODUCT_SETTINGS_ID, ...data })
    .onConflictDoUpdate({
      target: productSettings.id,
      set: { ...data, updatedAt: sql`now()` },
    });

  dev.log("saved shop ai defaults", data);
  revalidatePath("/settings/ai");
  return { ok: true };
}
