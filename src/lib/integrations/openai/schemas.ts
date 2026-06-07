import { z } from "zod";

import { ETSY_COLORS } from "@/lib/integrations/etsy/etsy-colors";
import { ETSY_ERA_VALUES } from "@/lib/products/draft-schema";

/**
 * Zod schemas for OpenAI Responses-API structured outputs. The
 * processor builds a JSON Schema from these (via `zod-to-json-schema`
 * or hand-derived shape) and asks the model to conform; the response
 * is then `safeParse`d to catch any drift.
 *
 * Sizes are tuned to the Etsy field caps:
 *   - title: 140 chars
 *   - description: 700 chars. Up to two short paragraphs: a tight
 *     observational first paragraph (~3 sentences) and an optional
 *     second paragraph that folds in seller comments in brand voice.
 *     Measurements are carried in the structured `measurements` field
 *     and rendered separately — never baked into this text — so the
 *     prose stays tight even as the published listing grows. (Etsy's
 *     own cap is 102 400.)
 *   - tags: 13 entries, each ≤ 20 chars (Etsy hard cap — tags over
 *     20 chars are rejected/truncated by Etsy, so generate within it)
 *   - materials: 13 entries, each ≤ 45 chars (Etsy hard cap)
 *
 * Note: `etsyTaxonomyId` is NOT part of this schema. It's derived
 * server-side from `clothingType` (see
 * `getEtsyTaxonomyForClothingType` in `products/clothing-types.ts`),
 * not picked by the model.
 */

export const EnrichmentOutput = z.object({
  titleEs: z.string().trim().min(10).max(140),
  descriptionEs: z.string().trim().min(40).max(700),
  etsyTagsEs: z
    .array(z.string().trim().min(1).max(20))
    .max(13),
  etsyMaterialsEs: z
    .array(z.string().trim().min(1).max(45))
    .max(13),
  etsyWhenMade: z.enum(ETSY_ERA_VALUES),
  etsyPrimaryColor: z.enum(ETSY_COLORS),
  etsySecondaryColor: z.enum(ETSY_COLORS).nullable(),
});

export type EnrichmentOutput = z.infer<typeof EnrichmentOutput>;
