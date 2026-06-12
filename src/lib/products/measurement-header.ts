/**
 * Measurement block shown in a listing description, right below the
 * size-conversion header (see `size-conversion.ts`). Example (ES):
 *
 *   Medidas:
 *   - Cintura: Plano 38cm - Contorno 76cm
 *   - Cadera: Plano 57.5cm - Contorno 115cm
 *   - Largo: 80cm
 *
 * Only the measurements the operator actually filled in are listed,
 * in the same order the form renders them for that garment.
 *
 * Storage is canonical-flat (as measured across the garment). The
 * garment registry marks which measurements double into a
 * circumference (`twoXMeasurements`); for those we print both the
 * flat value (`Plano`/`Flat`) and the doubled value
 * (`Contorno`/`Around`). Measurements that don't double print a
 * single value.
 *
 * Like the size header and the listing footer, this is resolved at the
 * payload boundary and prepended to the description — never stored in
 * the description column, so it stays out of the AI enrich +
 * translation paths and always reflects the live measurement columns.
 */

import type { ClothingType } from "@/lib/db/schema";

import {
  doublesAtBoundary,
  getClothingType,
  type Measurement,
} from "./clothing-types";
import { type ProductMeasurements } from "./measurements";

/** Heading that introduces the measurement list. */
const HEADING: Record<"es" | "en", string> = {
  es: "Medidas:",
  en: "Measurements:",
};

/** Per-locale label for each measurement (mirrors the form i18n). */
const MEASUREMENT_LABELS: Record<"es" | "en", Record<Measurement, string>> = {
  es: {
    shoulder: "Hombro a hombro",
    sleeveWidth: "Ancho de manga",
    sleeveLength: "Largo de manga",
    chest: "Pecho",
    waist: "Cintura",
    hip: "Cadera",
    rise: "Tiro",
    leg: "Pierna",
    length: "Largo",
    braSize: "Talla de copa",
  },
  en: {
    shoulder: "Shoulder",
    sleeveWidth: "Sleeve width",
    sleeveLength: "Sleeve length",
    chest: "Chest",
    waist: "Waist",
    hip: "Hip",
    rise: "Rise",
    leg: "Leg",
    length: "Length",
    braSize: "Cup size",
  },
};

/** Labels for the elastic-waist min/max pair. */
const WAIST_MIN_LABEL: Record<"es" | "en", string> = {
  es: "Cintura mínima",
  en: "Minimum waist",
};
const WAIST_MAX_LABEL: Record<"es" | "en", string> = {
  es: "Cintura máxima",
  en: "Maximum waist",
};

/** Flat / circumference qualifiers for doubled measurements. */
const FLAT_WORD: Record<"es" | "en", string> = { es: "Plano", en: "Flat" };
const AROUND_WORD: Record<"es" | "en", string> = {
  es: "Contorno",
  en: "Around",
};

/** Joiner between the measurement block and the description body. */
const BLOCK_SEPARATOR = "\n\n";

/** Formats a cm value, dropping float noise (e.g. 57.5 → `57.5cm`). */
function formatCm(value: number): string {
  return `${Math.round(value * 100) / 100}cm`;
}

/**
 * Renders the value portion of one measurement line. Doubled
 * measurements print `Plano Xcm - Contorno 2Xcm`; the rest print a
 * single `Xcm`.
 */
function formatValue(
  flat: number,
  doubles: boolean,
  locale: "es" | "en",
): string {
  if (!doubles) return formatCm(flat);
  return `${FLAT_WORD[locale]} ${formatCm(flat)} - ${AROUND_WORD[locale]} ${formatCm(flat * 2)}`;
}

/**
 * Builds the localized measurement block for a product, or `null` when
 * the clothing type is unknown or no measurements are filled in (so
 * callers can omit the block entirely).
 *
 * @param clothingType - the product's garment type (drives order + doubling)
 * @param measurements - the product's stored flat measurement values
 * @param locale - `"es"` → Spanish labels, `"en"` → English labels
 */
export function formatMeasurementBlock(
  clothingType: ClothingType | null,
  measurements: ProductMeasurements,
  locale: "es" | "en",
): string | null {
  if (!clothingType) return null;
  const entry = getClothingType(clothingType);
  if (!entry) return null;

  const labels = MEASUREMENT_LABELS[locale];
  const lines: string[] = [];

  const columnFor: Record<
    Exclude<Measurement, "braSize" | "waist">,
    number | null
  > = {
    shoulder: measurements.shoulderCm,
    sleeveWidth: measurements.sleeveWidthCm,
    sleeveLength: measurements.sleeveLengthCm,
    chest: measurements.chestCm,
    hip: measurements.hipCm,
    rise: measurements.riseCm,
    leg: measurements.legCm,
    length: measurements.lengthCm,
  };

  for (const measurement of entry.measurements) {
    if (measurement === "waist") {
      // Stored as a min/max pair. Elastic waistbands (waistMaxCm set)
      // render two lines; otherwise a single `Cintura` line.
      const doubles = doublesAtBoundary(clothingType, "waist");
      const min = measurements.waistCm;
      const max = measurements.waistMaxCm;
      if (min != null && max != null) {
        lines.push(
          `- ${WAIST_MIN_LABEL[locale]}: ${formatValue(min, doubles, locale)}`,
        );
        lines.push(
          `- ${WAIST_MAX_LABEL[locale]}: ${formatValue(max, doubles, locale)}`,
        );
      } else if (min != null) {
        lines.push(
          `- ${labels.waist}: ${formatValue(min, doubles, locale)}`,
        );
      }
      continue;
    }

    if (measurement === "braSize") {
      const value = measurements.braSize?.trim();
      if (value) lines.push(`- ${labels.braSize}: ${value}`);
      continue;
    }

    const flat = columnFor[measurement];
    if (flat == null) continue;
    const doubles = doublesAtBoundary(clothingType, measurement);
    lines.push(`- ${labels[measurement]}: ${formatValue(flat, doubles, locale)}`);
  }

  if (lines.length === 0) return null;
  return `${HEADING[locale]}\n${lines.join("\n")}`;
}

/**
 * Prepends the localized measurement block to a description `body`,
 * separated by a blank line. No-ops (returns `body` unchanged) when
 * there is nothing to render, so callers can invoke it
 * unconditionally. Intended to sit between the size header (above) and
 * the description body (below).
 *
 * @param body - the description body (already footer-appended)
 * @param clothingType - the product's garment type
 * @param measurements - the product's stored flat measurement values
 * @param locale - language of the labels
 */
export function prependMeasurementBlock(
  body: string,
  clothingType: ClothingType | null,
  measurements: ProductMeasurements,
  locale: "es" | "en",
): string {
  const block = formatMeasurementBlock(clothingType, measurements, locale);
  if (!block) return body;
  const trimmedBody = body.trim();
  if (!trimmedBody) return block;
  return `${block}${BLOCK_SEPARATOR}${trimmedBody}`;
}
