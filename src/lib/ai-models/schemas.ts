import { z } from "zod";

import {
  AGE_RANGE_VALUES,
  BODY_TYPE_VALUES,
  FACE_SHAPE_VALUES,
  HAIR_COLOR_VALUES,
  HAIR_SHAPE_VALUES,
  HAIR_TYPE_VALUES,
  HEIGHT_RANGE_VALUES,
  SKIN_TONE_VALUES,
} from "./variables";

/**
 * Zod schema for the "Nuevo modelo" form. Every field is a select
 * over the curated values in `./variables.ts`; the server actions
 * pin to the same enums so a tampered client request can't smuggle
 * arbitrary text into the prompt.
 */
export const NewModelSchema = z.object({
  ageRange: z.enum(AGE_RANGE_VALUES),
  bodyType: z.enum(BODY_TYPE_VALUES),
  heightRange: z.enum(HEIGHT_RANGE_VALUES),
  skinTone: z.enum(SKIN_TONE_VALUES),
  faceShape: z.enum(FACE_SHAPE_VALUES),
  hairColor: z.enum(HAIR_COLOR_VALUES),
  hairShape: z.enum(HAIR_SHAPE_VALUES),
  hairType: z.enum(HAIR_TYPE_VALUES),
});

export type NewModelInput = z.infer<typeof NewModelSchema>;

/** Schema for the post-generation Save modal. */
export const SaveModelSchema = z.object({
  label: z.string().trim().min(1, "El nombre es obligatorio").max(60),
});

export type SaveModelInput = z.infer<typeof SaveModelSchema>;
