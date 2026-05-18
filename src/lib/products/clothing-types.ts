import type { ClothingType } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  getTaxonomyByKey,
  type EtsyTaxonomyEntry,
} from "@/lib/integrations/etsy/taxonomy";

/**
 * Garment registry — single source of truth for the 15 clothing types
 * the admin supports.
 *
 * Adding a new type means: one entry here + the value added to the
 * `clothing_type` Postgres enum (and a migration) + a Spanish label
 * added under `m.products.clothingTypes.{value}` in
 * `messages.es.ts`. Display labels live in i18n, never in this file.
 *
 * The form picker, measurement renderer, and Etsy-side adapter all
 * read from this registry.
 */

export type GarmentCategory = "upper" | "lower" | "complete" | "special";

/**
 * Body-region measurements + bra size. Each maps 1:1 to a column on
 * `products`: `shoulder` → `shoulderCm`, `braSize` → `braSize`.
 */
export type Measurement =
  | "shoulder"
  | "chest"
  | "waist"
  | "hip"
  | "rise"
  | "leg"
  | "length"
  | "braSize";

export type ClothingTypeEntry = {
  /** DB enum value. Matches the `clothing_type` Postgres enum. */
  value: ClothingType;
  /** Used to group the picker UI (Upper / Lower / Complete / Special). */
  category: GarmentCategory;
  /** Measurements the form should render for this garment. */
  measurements: Measurement[];
  /**
   * Subset of `measurements` whose stored value is the **flat** cm
   * (as measured across the garment) and gets doubled at the
   * Etsy/website boundary to express circumference.
   */
  twoXMeasurements: Measurement[];
  /**
   * Default Etsy taxonomy key for this garment. Matches a `key`
   * in `ETSY_TAXONOMIES`. The autosave for `clothingType` derives
   * `products.etsyTaxonomyId` from this mapping — the user never
   * picks a taxonomy by hand.
   */
  etsyTaxonomyKey: string;
};

export const CLOTHING_TYPES: ClothingTypeEntry[] = [
  // Upper body.
  {
    value: "shirt",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
  },
  {
    value: "vest",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
  },
  {
    value: "top",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
  },
  {
    value: "sweater",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_sweaters",
  },
  {
    value: "jacket",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_jackets_and_coats",
  },
  {
    value: "trench_coat",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_outerwear_trench",
  },

  // Special upper body.
  {
    value: "corset",
    category: "special",
    measurements: ["chest", "length", "braSize"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_intimates_corsets",
  },

  // Lower body.
  {
    value: "jean",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_jeans",
  },
  {
    value: "pant",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_pants",
  },
  {
    value: "skirt",
    category: "lower",
    measurements: ["waist", "hip", "length"],
    twoXMeasurements: ["waist", "hip"],
    etsyTaxonomyKey: "womens_skirts",
  },
  {
    value: "short",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_shorts",
  },

  // Complete garments.
  {
    value: "set",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["chest", "waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_clothing_sets",
  },
  {
    value: "overall",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["chest", "waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_jumpsuits_and_rompers",
  },
  {
    value: "dress",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "length"],
    twoXMeasurements: ["chest", "waist", "hip"],
    etsyTaxonomyKey: "womens_dresses",
  },
  {
    value: "bodysuit",
    category: "complete",
    measurements: [],
    twoXMeasurements: [],
    etsyTaxonomyKey: "womens_bodysuits",
  },
];

/** Map of value → entry. Cheap to recompute, but cached for repeated lookups. */
const BY_VALUE = new Map<ClothingType, ClothingTypeEntry>(
  CLOTHING_TYPES.map((entry) => [entry.value, entry]),
);

/**
 * Returns the registry entry for a clothing type, or `undefined` if
 * the value isn't registered (which should never happen given the DB
 * enum is the source of allowed values).
 */
export function getClothingType(
  value: ClothingType,
): ClothingTypeEntry | undefined {
  return BY_VALUE.get(value);
}

/** Spanish label (from i18n) for the given clothing type. */
export function getClothingTypeLabel(value: ClothingType): string {
  return m.products.clothingTypes[value] ?? value;
}

/** Measurements rendered for the given clothing type, or `[]`. */
export function getRequiredMeasurements(value: ClothingType): Measurement[] {
  return BY_VALUE.get(value)?.measurements ?? [];
}

/**
 * `true` if the given measurement value is stored flat and needs to
 * be doubled at the Etsy / website boundary for this clothing type.
 */
export function doublesAtBoundary(
  value: ClothingType,
  measurement: Measurement,
): boolean {
  return BY_VALUE.get(value)?.twoXMeasurements.includes(measurement) ?? false;
}

/** Entries belonging to the given category — used by the grouped picker UI. */
export function getClothingTypesByCategory(
  category: GarmentCategory,
): ClothingTypeEntry[] {
  return CLOTHING_TYPES.filter((entry) => entry.category === category);
}

/**
 * The default Etsy taxonomy entry for a clothing type. Returns
 * `undefined` if the registry entry is missing or its key isn't in
 * `ETSY_TAXONOMIES` (a development-time consistency error).
 *
 * Used by `updateProductDraftField` to derive `etsyTaxonomyId`
 * whenever a clothing type is set — the user never picks a
 * taxonomy by hand.
 */
export function getEtsyTaxonomyForClothingType(
  value: ClothingType,
): EtsyTaxonomyEntry | undefined {
  const entry = BY_VALUE.get(value);
  return entry ? getTaxonomyByKey(entry.etsyTaxonomyKey) : undefined;
}

/** Spanish category label (from i18n) for the picker section headers. */
export function getCategoryLabel(category: GarmentCategory): string {
  return m.products.categories[category];
}
