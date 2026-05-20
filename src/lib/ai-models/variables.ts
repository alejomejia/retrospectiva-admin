/**
 * Allowed values for the base-model identity variables. These are
 * interpolated verbatim into `BASE_MODEL_GENERATION` at generation
 * time (see `phase-1-base-model.md` §4).
 *
 * Ethnicity is no longer user-selectable — the shop's focus group is
 * European, so the prompt template hardcodes that descriptor.
 *
 * Keeping these as `as const` arrays lets the form's zod schemas
 * derive enums from them without drift.
 */

export const AGE_RANGE_VALUES = [
  "woman in her early 20s",
  "woman in her late 20s",
  "woman in her early 30s",
] as const;
export type AgeRange = (typeof AGE_RANGE_VALUES)[number];
export const AGE_RANGE_DEFAULT: AgeRange = "woman in her late 20s";

export const BODY_TYPE_VALUES = ["slim", "athletic", "curvy"] as const;
export type BodyType = (typeof BODY_TYPE_VALUES)[number];
export const BODY_TYPE_DEFAULT: BodyType = "athletic";

export const HEIGHT_RANGE_VALUES = ["160cm", "170cm", "180cm"] as const;
export type HeightRange = (typeof HEIGHT_RANGE_VALUES)[number];
export const HEIGHT_RANGE_DEFAULT: HeightRange = "170cm";

export const SKIN_TONE_VALUES = ["fair skin", "warm tan skin"] as const;
export type SkinTone = (typeof SKIN_TONE_VALUES)[number];
export const SKIN_TONE_DEFAULT: SkinTone = "fair skin";

export const FACE_SHAPE_VALUES = [
  "oval",
  "heart-shaped",
  "round",
  "square",
  "diamond",
] as const;
export type FaceShape = (typeof FACE_SHAPE_VALUES)[number];

/**
 * Hair is split into three axes: color, shape, and texture. The
 * three values are concatenated at prompt time into a phrase like
 * `dark brown low ponytail wavy hair`.
 */
export const HAIR_COLOR_VALUES = [
  "blonde",
  "red",
  "black",
  "dark brown",
  "light brown",
] as const;
export type HairColor = (typeof HAIR_COLOR_VALUES)[number];

export const HAIR_SHAPE_VALUES = [
  "short bob",
  "low ponytail",
  "high ponytail",
  "updo",
  "bun",
] as const;
export type HairShape = (typeof HAIR_SHAPE_VALUES)[number];

export const HAIR_TYPE_VALUES = ["wavy", "straight"] as const;
export type HairType = (typeof HAIR_TYPE_VALUES)[number];
