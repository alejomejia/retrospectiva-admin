import { z } from "zod";

import { IMAGE_QUALITY_VALUES } from "@/lib/ai-models/variables";
import { clothingType, productCondition } from "@/lib/db/schema";
import { ETSY_COLORS } from "@/lib/integrations/etsy/etsy-colors";
import { ETSY_SIZES } from "@/lib/integrations/etsy/etsy-sizes";
import { PANEL_ORDER } from "@/lib/integrations/openai/panel-keys";

/**
 * Per-field patch schema for the autosave server action used by both
 * the new-product stepper and the flat edit form. Every field is
 * optional + nullable so partial updates work; the action validates
 * whichever subset of fields the client sent.
 *
 * Required-for-publish enforcement happens at the publish action,
 * NOT here. A draft is allowed to have most fields null until the
 * user is ready to ship it.
 */

/**
 * Allowed size values for the product form. Mirrors Etsy's "Women's
 * Clothing (US Letter)" attribute scale so a row's `size` column can
 * be sent verbatim on the listing publish.
 */
export const SIZE_VALUES = ETSY_SIZES;
export type SizeValue = (typeof SIZE_VALUES)[number];

export const ETSY_ERA_VALUES = [
  "1990s",
  "1980s",
  "1970s",
  "1960s",
  "1950s",
  "before_1950",
] as const;
export type EtsyEra = (typeof ETSY_ERA_VALUES)[number];

// ----- Image-placement enums (Task 11) -----------------------------
//
// Declared here (not in image-placement-prompts.ts) so client form
// components can import them without pulling the server-only prompt
// module into the browser bundle. `image-placement-prompts.ts` is
// the consumer and re-uses these same `as const` arrays for its
// typed `POSES`/`FRAMINGS`/`ENVIRONMENTS` records.

export const AI_POSE_PRESETS = [
  "soft_relaxed",
  "soft_movement",
  "structured_posture",
] as const;
export type AiPosePreset = (typeof AI_POSE_PRESETS)[number];

export const AI_FRAMING_PRESETS = [
  "waist_up",
  "thighs_up",
  "full_body",
  "close_detail",
] as const;
export type AiFramingPreset = (typeof AI_FRAMING_PRESETS)[number];

export const AI_ENVIRONMENT_PRESETS = [
  "textured_wall",
  "minimal_apartment",
  "soft_studio",
  "vintage_home",
  "window_light",
] as const;
export type AiEnvironmentPreset = (typeof AI_ENVIRONMENT_PRESETS)[number];

export const AI_FIT_OVERRIDES = ["tight", "loose", "oversized"] as const;
export type AiFitOverride = (typeof AI_FIT_OVERRIDES)[number];

const cm = z
  .number()
  .min(1, { message: "Debe ser mayor que 0" })
  .max(500, { message: "Demasiado grande" })
  // Allow halves/tenths but no finer; mirrors the input's 0.5 step.
  .refine((n) => Number.isInteger(n * 10), {
    message: "Máximo un decimal",
  });

const trimmedShortString = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const longString = (max: number) =>
  z.string().trim().max(max).nullable().optional();
const stringArray = (maxLen: number, maxItem: number) =>
  z
    .array(z.string().trim().min(1).max(maxItem))
    .max(maxLen)
    .optional();

export const ProductDraftPatchSchema = z.object({
  // Identity
  titleEs: trimmedShortString(140),
  titleEn: trimmedShortString(140),
  descriptionEs: longString(2000),
  descriptionEn: longString(2000),

  // User notes sent to the AI enrichment prompt
  comments: longString(1000),

  // Pricing
  basePriceCents: z.number().int().nonnegative().nullable().optional(),
  markupPercentOverride: z
    .number()
    .int()
    .min(0)
    .max(500)
    .nullable()
    .optional(),
  listPriceCentsOverride: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  buyPriceCents: z.number().int().nonnegative().nullable().optional(),
  // Per-product sale percentage. null = no discount. The form's toggle
  // writes `DEFAULT_DISCOUNT_PERCENT`; the column accepts any 1–99.
  discountPercent: z.number().int().min(0).max(99).nullable().optional(),

  // Garment attributes
  clothingType: z.enum(clothingType.enumValues).nullable().optional(),
  condition: z.enum(productCondition.enumValues).nullable().optional(),
  size: z.enum(SIZE_VALUES).nullable().optional(),

  // Shop-curated highlight. Maps to Etsy `featured_rank` on publish
  // (Etsy caps featured listings at 4 per shop).
  isFeatured: z.boolean().optional(),

  // Measurements
  shoulderCm: cm.nullable().optional(),
  sleeveWidthCm: cm.nullable().optional(),
  sleeveLengthCm: cm.nullable().optional(),
  chestCm: cm.nullable().optional(),
  waistCm: cm.nullable().optional(),
  hipCm: cm.nullable().optional(),
  riseCm: cm.nullable().optional(),
  legCm: cm.nullable().optional(),
  lengthCm: cm.nullable().optional(),
  braSize: trimmedShortString(20),

  // Etsy-bound AI metadata
  etsyTagsEs: stringArray(13, 30),
  etsyTagsEn: stringArray(13, 30),
  etsyMaterialsEs: stringArray(13, 45),
  etsyMaterialsEn: stringArray(13, 45),
  etsyWhenMade: z.enum(ETSY_ERA_VALUES).nullable().optional(),
  etsyTaxonomyId: z.number().int().positive().nullable().optional(),
  etsyPrimaryColor: z.enum(ETSY_COLORS).nullable().optional(),
  etsySecondaryColor: z.enum(ETSY_COLORS).nullable().optional(),

  // Etsy shipping profile id. Auto-derived from the shop-wide
  // weight-class mapping on each clothing-type change (see
  // `updateProductDraftField`), but the user can override on the
  // step-1 form.
  shippingProfileId: z.number().int().positive().nullable().optional(),

  // Per-product override for the shop-wide AI image generation
  // toggle. null = inherit shop default.
  aiImageEnabled: z.boolean().nullable().optional(),

  // ----- Image-placement inputs (Task 11) -------------------------
  // null = no AI image for this product (worker short-circuits at
  // enqueue time). Pose/framing/environment have hard-coded defaults
  // in the DB so updates always send a concrete value when present.
  // `aiSourcePanel` null = worker resolves the category default per
  // `clothingType` (see `resolveSourcePanel` in image-placement-prompts.ts).
  aiModelId: z.uuid().nullable().optional(),
  aiSourcePanel: z.enum(PANEL_ORDER).nullable().optional(),
  aiPosePreset: z.enum(AI_POSE_PRESETS).optional(),
  aiFramingPreset: z.enum(AI_FRAMING_PRESETS).optional(),
  aiEnvironmentPreset: z.enum(AI_ENVIRONMENT_PRESETS).optional(),
  aiFitOverride: z.enum(AI_FIT_OVERRIDES).nullable().optional(),
  // `gpt-image-2` quality tier for the per-product placement call.
  // Not-nullable in the DB (text column with default 'low'); zod
  // mirrors that with `.optional()` rather than `.nullable()`.
  aiImageQuality: z.enum(IMAGE_QUALITY_VALUES).optional(),

  // Lifecycle
  scheduledPublishAt: z.string().datetime().nullable().optional(),
});

export type ProductDraftPatch = z.infer<typeof ProductDraftPatchSchema>;

/**
 * Required fields for the publish actions on step 4. Step 1's "Next"
 * button enforces the subset needed before the AI step. Title is
 * NOT here — AI generates it in step 2.
 */
export const STEP_1_REQUIRED: Array<keyof ProductDraftPatch> = [
  "basePriceCents",
  "clothingType",
  "condition",
  "shippingProfileId",
];
