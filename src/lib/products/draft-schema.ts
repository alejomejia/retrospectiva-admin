import { z } from "zod";

import { clothingType, productCondition } from "@/lib/db/schema";
import { ETSY_COLORS } from "@/lib/integrations/etsy/etsy-colors";
import { ETSY_SIZES } from "@/lib/integrations/etsy/etsy-sizes";

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

const cm = z
  .number()
  .min(1, { message: "Must be greater than 0" })
  .max(500, { message: "Too large" })
  // Allow halves/tenths but no finer; mirrors the input's 0.5 step.
  .refine((n) => Number.isInteger(n * 10), {
    message: "At most one decimal",
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
  waistMaxCm: cm.nullable().optional(),
  hipCm: cm.nullable().optional(),
  riseCm: cm.nullable().optional(),
  legCm: cm.nullable().optional(),
  lengthCm: cm.nullable().optional(),
  braSize: trimmedShortString(20),

  // Etsy-bound AI metadata
  etsyTagsEs: stringArray(13, 20),
  etsyTagsEn: stringArray(13, 20),
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
