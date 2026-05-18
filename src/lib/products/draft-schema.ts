import { z } from "zod";

import { clothingType, productCondition } from "@/lib/db/schema";

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

export const SIZE_VALUES = [
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "one_size",
] as const;
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

const intCm = z
  .number()
  .int({ message: "Debe ser un número entero" })
  .min(1, { message: "Debe ser mayor que 0" })
  .max(500, { message: "Demasiado grande" });

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

  // Garment attributes
  clothingType: z.enum(clothingType.enumValues).nullable().optional(),
  condition: z.enum(productCondition.enumValues).nullable().optional(),
  sizes: z
    .array(z.enum(SIZE_VALUES))
    .max(SIZE_VALUES.length)
    .optional(),

  // Measurements
  shoulderCm: intCm.nullable().optional(),
  chestCm: intCm.nullable().optional(),
  waistCm: intCm.nullable().optional(),
  hipCm: intCm.nullable().optional(),
  riseCm: intCm.nullable().optional(),
  legCm: intCm.nullable().optional(),
  lengthCm: intCm.nullable().optional(),
  braSize: trimmedShortString(20),

  // Etsy-bound AI metadata
  etsyTagsEs: stringArray(13, 30),
  etsyTagsEn: stringArray(13, 30),
  etsyMaterialsEs: stringArray(13, 45),
  etsyMaterialsEn: stringArray(13, 45),
  etsyWhenMade: z.enum(ETSY_ERA_VALUES).nullable().optional(),
  etsyTaxonomyId: z.number().int().positive().nullable().optional(),

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
];
