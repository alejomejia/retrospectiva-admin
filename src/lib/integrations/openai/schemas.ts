import { z } from "zod";

import { ETSY_ERA_VALUES } from "@/lib/products/draft-schema";

/**
 * Zod schemas for OpenAI Responses-API structured outputs. The
 * processor builds a JSON Schema from these (via `zod-to-json-schema`
 * or hand-derived shape) and asks the model to conform; the response
 * is then `safeParse`d to catch any drift.
 *
 * Sizes are tuned to the Etsy field caps:
 *   - title: 140 chars
 *   - description: 2000 chars (Etsy allows 102 400 but anything
 *     beyond ~2k is rarely read)
 *   - tags: 13 entries, each ≤ 30 chars (Etsy hard cap)
 *   - materials: 13 entries, each ≤ 45 chars (Etsy hard cap)
 *
 * Note: `etsyTaxonomyId` is NOT part of this schema. It's derived
 * server-side from `clothingType` (see
 * `getEtsyTaxonomyForClothingType` in `products/clothing-types.ts`),
 * not picked by the model.
 */

export const EnrichmentOutput = z.object({
  titleEs: z.string().trim().min(10).max(140),
  descriptionEs: z.string().trim().min(40).max(2000),
  etsyTagsEs: z
    .array(z.string().trim().min(1).max(30))
    .max(13),
  etsyMaterialsEs: z
    .array(z.string().trim().min(1).max(45))
    .max(13),
  etsyWhenMade: z.enum(ETSY_ERA_VALUES),
});

export type EnrichmentOutput = z.infer<typeof EnrichmentOutput>;
