import type { ClothingType } from "@/lib/db/schema";
import { getClothingType, type Measurement } from "./clothing-types";

/**
 * Measurement helpers. Storage is canonical-flat (as measured across
 * the garment). Boundaries (Etsy listing description, website
 * webhook payload, display hints) call `doubledMeasurements` to get
 * the circumference values. Form layer reads/writes flat.
 *
 * See [docs/product-form.md](../../../docs/product-form.md) §3.
 */

export type ProductMeasurements = {
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  riseCm: number | null;
  legCm: number | null;
  lengthCm: number | null;
  braSize: string | null;
};

const MEASUREMENT_TO_COLUMN: Record<
  Exclude<Measurement, "braSize">,
  Exclude<keyof ProductMeasurements, "braSize">
> = {
  shoulder: "shoulderCm",
  chest: "chestCm",
  waist: "waistCm",
  hip: "hipCm",
  rise: "riseCm",
  leg: "legCm",
  length: "lengthCm",
};

/**
 * Maps a registry `Measurement` to its `ProductMeasurements` column
 * name. Bra size is its own column (string, not int), so it's not in
 * the int map.
 */
export function measurementToColumn(
  m: Measurement,
): keyof ProductMeasurements {
  return m === "braSize" ? "braSize" : MEASUREMENT_TO_COLUMN[m];
}

/**
 * Returns the same row unchanged. Provided as a named function so
 * callers can write `flatMeasurements(p)` to make intent obvious at
 * call sites (vs reading the column straight off the row, which would
 * leave the reader guessing whether doubling happened).
 */
export function flatMeasurements(p: ProductMeasurements): ProductMeasurements {
  return { ...p };
}

/**
 * Doubles the chest/waist/hip/leg fields **only for the measurements
 * that the given clothing type marks as x2**. Bra size is never
 * doubled.
 *
 * If `clothingType` is null (a fresh draft), returns the input
 * unchanged — we don't know yet which measurements would double.
 */
export function doubledMeasurements(
  clothingType: ClothingType | null,
  p: ProductMeasurements,
): ProductMeasurements {
  if (!clothingType) return { ...p };
  const entry = getClothingType(clothingType);
  if (!entry) return { ...p };
  const out: ProductMeasurements = { ...p };
  for (const m of entry.twoXMeasurements) {
    if (m === "braSize") continue;
    const key = MEASUREMENT_TO_COLUMN[m];
    const value = out[key];
    if (typeof value === "number") {
      out[key] = value * 2;
    }
  }
  return out;
}
