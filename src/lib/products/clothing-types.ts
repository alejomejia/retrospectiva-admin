import type { ClothingType } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
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
 * `messages.en.ts`. Display labels live in i18n, never in this file.
 *
 * The form picker, measurement renderer, and Etsy-side adapter all
 * read from this registry.
 */

export type GarmentCategory = "upper" | "lower" | "complete" | "special";

/**
 * Three-tier shipping weight class used to auto-pick an Etsy shipping
 * profile at step-1. Maps to the shop-wide mapping configured in
 * `etsy_oauth.shipping_profile_{light,medium,heavy}_id`.
 */
export type ShippingWeightClass = "light" | "medium" | "heavy";

/**
 * Body-region measurements + bra size. Each maps 1:1 to a column on
 * `products`: `shoulder` → `shoulderCm`, `braSize` → `braSize`.
 */
export type Measurement =
  | "shoulder"
  | "sleeveWidth"
  | "sleeveLength"
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
  /**
   * Default shipping weight class for this garment. Step-1 uses it to
   * auto-pick an Etsy shipping profile from the shop-wide mapping.
   * The user can override the picked profile on the product form.
   */
  shippingWeightClass: ShippingWeightClass;
};

export const CLOTHING_TYPES: ClothingTypeEntry[] = [
  // Upper body.
  {
    value: "shirt",
    category: "upper",
    measurements: ["shoulder", "sleeveWidth", "sleeveLength", "chest", "length"],
    twoXMeasurements: ["sleeveWidth", "chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
    shippingWeightClass: "light",
  },
  {
    value: "vest",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
    shippingWeightClass: "light",
  },
  {
    value: "top",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_tops_and_tees",
    shippingWeightClass: "light",
  },
  {
    value: "sweater",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_sweaters",
    shippingWeightClass: "medium",
  },
  {
    value: "jacket",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_jackets_and_coats",
    shippingWeightClass: "heavy",
  },
  {
    value: "trench_coat",
    category: "upper",
    measurements: ["shoulder", "chest", "length"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_outerwear_trench",
    shippingWeightClass: "heavy",
  },

  // Special upper body.
  {
    value: "corset",
    category: "special",
    measurements: ["chest", "length", "braSize"],
    twoXMeasurements: ["chest"],
    etsyTaxonomyKey: "womens_intimates_corsets",
    shippingWeightClass: "medium",
  },

  // Lower body.
  {
    value: "jean",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_jeans",
    shippingWeightClass: "medium",
  },
  {
    value: "pant",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_pants",
    shippingWeightClass: "medium",
  },
  {
    value: "skirt",
    category: "lower",
    measurements: ["waist", "hip", "length"],
    twoXMeasurements: ["waist", "hip"],
    etsyTaxonomyKey: "womens_skirts",
    shippingWeightClass: "light",
  },
  {
    value: "short",
    category: "lower",
    measurements: ["waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_shorts",
    shippingWeightClass: "light",
  },

  // Complete garments.
  {
    value: "set",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["chest", "waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_clothing_sets",
    shippingWeightClass: "medium",
  },
  {
    value: "overall",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "rise", "leg", "length"],
    twoXMeasurements: ["chest", "waist", "hip", "leg"],
    etsyTaxonomyKey: "womens_jumpsuits_and_rompers",
    shippingWeightClass: "medium",
  },
  {
    value: "dress",
    category: "complete",
    measurements: ["shoulder", "chest", "waist", "hip", "length"],
    twoXMeasurements: ["chest", "waist", "hip"],
    etsyTaxonomyKey: "womens_dresses",
    shippingWeightClass: "light",
  },
  {
    value: "bodysuit",
    category: "complete",
    measurements: [],
    twoXMeasurements: [],
    etsyTaxonomyKey: "womens_bodysuits",
    shippingWeightClass: "medium",
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

/**
 * Shipping weight class for the given clothing type, used to look up
 * the Etsy shipping profile from the shop-wide mapping. Falls back to
 * `"medium"` if the type isn't registered.
 */
export function getShippingWeightClass(
  value: ClothingType,
): ShippingWeightClass {
  return BY_VALUE.get(value)?.shippingWeightClass ?? "medium";
}

/** Measurements rendered for the given clothing type, or `[]`. */
export function getRequiredMeasurements(value: ClothingType): Measurement[] {
  return BY_VALUE.get(value)?.measurements ?? [];
}

/**
 * Measurements that are rendered for a garment but not required to
 * proceed. `shoulder` is optional everywhere because strapless cuts
 * (e.g. a strapless dress or top) have no shoulder to measure.
 * `waist` and `chest` are optional so a garment can be published
 * without them when the measurement isn't meaningful or available.
 */
export const OPTIONAL_MEASUREMENTS: ReadonlySet<Measurement> = new Set([
  "shoulder",
  "waist",
  "chest",
]);

/** `false` for measurements that are rendered but optional to fill in. */
export function isMeasurementRequired(measurement: Measurement): boolean {
  return !OPTIONAL_MEASUREMENTS.has(measurement);
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
