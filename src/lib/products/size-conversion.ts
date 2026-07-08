/**
 * Size-conversion header shown at the very start of a listing
 * description (e.g. `Size: S | EU 36 | UK 8 | US 4`).
 *
 * The product form constrains `size` to Etsy's "Women's Clothing (US
 * Letter)" scale (XXS–3X) for every garment type, and the alpha→EU/UK/US
 * numeric mapping is uniform across women's tops, dresses and bottoms —
 * an S top and an S dress convert to the same EU 36 / UK 8 / US 4. So
 * the conversion is keyed on the letter size alone; it does not vary by
 * `clothingType`. (If a future garment family uses a different scale —
 * e.g. footwear — add a per-category table here.)
 *
 * Resolved at the payload boundary and prepended to the description,
 * never stored in the description column — same discipline as the
 * listing footer, keeping it out of the AI enrich + translation paths.
 * Because it reads the live `size` column at publish time, editing the
 * size always reflects in the next published description with no
 * re-enrichment.
 */

import type { ProductCondition } from "@/lib/db/schema";
import { type EtsySize, isEtsySize } from "@/lib/integrations/etsy/etsy-sizes";

/** Locale label for the header prefix. */
const HEADER_LABEL: Record<"es" | "en", string> = {
  es: "Talla",
  en: "Size",
};

/** Locale label for the condition segment of the header. */
const CONDITION_LABEL: Record<"es" | "en", string> = {
  es: "Estado",
  en: "Condition",
};

/** Localized condition value shown after the size conversion. */
const CONDITION_VALUE: Record<"es" | "en", Record<ProductCondition, string>> = {
  es: { excellent: "Excelente", very_good: "Muy bueno", good: "Bueno" },
  en: { excellent: "Excellent", very_good: "Very good", good: "Good" },
};

/** Joiner between the size header and the description body. */
const HEADER_SEPARATOR = "\n\n";

/** Joiner between header segments (size parts and condition). */
const SEGMENT_SEPARATOR = " | ";

type RegionSizes = { eu: number; uk: number; us: number };

/**
 * Women's US-letter → EU/UK/US numeric equivalents. Single
 * representative value per region (standard women's apparel chart).
 */
const SIZE_CONVERSIONS: Record<EtsySize, RegionSizes> = {
  XXS: { eu: 32, uk: 4, us: 0 },
  XS: { eu: 34, uk: 6, us: 2 },
  S: { eu: 36, uk: 8, us: 4 },
  M: { eu: 40, uk: 12, us: 8 },
  L: { eu: 44, uk: 16, us: 12 },
  XL: { eu: 48, uk: 20, us: 16 },
  XXL: { eu: 52, uk: 24, us: 20 },
  "1X": { eu: 46, uk: 18, us: 14 },
  "2X": { eu: 50, uk: 22, us: 18 },
  "3X": { eu: 54, uk: 26, us: 22 },
};

/**
 * Label-less size + regional conversions joined by `separator`, e.g.
 * `S · EU 36 · UK 8 · US 4`. Same numbers as `formatSizeHeader` but
 * without the locale `Size:`/`Talla:` prefix — for compact surfaces
 * like the Instagram-story eyebrow. Returns `null` when the size is
 * missing/unrecognized so callers can omit the segment.
 *
 * @param size - the product's stored size value (US-letter scale)
 * @param separator - joiner between segments (default ` · `)
 */
export function formatSizeBadge(
  size: string | null | undefined,
  separator = " · ",
): string | null {
  if (!isEtsySize(size)) return null;
  const { eu, uk, us } = SIZE_CONVERSIONS[size];
  return [size, `EU ${eu}`, `UK ${uk}`, `US ${us}`].join(separator);
}

/**
 * Builds the localized size header for a product, e.g.
 * `Size: S | EU 36 | UK 8 | US 4 | Condition: Excellent`. The condition
 * segment is appended only when a condition is supplied. Returns `null`
 * when no usable size is set (so callers can omit the line entirely).
 *
 * @param size - the product's stored size value (US-letter scale)
 * @param locale - `"es"` → `Talla:` prefix, `"en"` → `Size:` prefix
 * @param condition - the product's condition; omits the segment when absent
 */
export function formatSizeHeader(
  size: string | null | undefined,
  locale: "es" | "en",
  condition?: ProductCondition | null,
): string | null {
  if (!isEtsySize(size)) return null;
  const { eu, uk, us } = SIZE_CONVERSIONS[size];
  let header = `${HEADER_LABEL[locale]}: ${size} | EU ${eu} | UK ${uk} | US ${us}`;
  if (condition) {
    header += `${SEGMENT_SEPARATOR}${CONDITION_LABEL[locale]}: ${CONDITION_VALUE[locale][condition]}`;
  }
  return header;
}

/**
 * Prepends the localized size header to a description `body`, separated
 * by a blank line. No-ops (returns `body` unchanged) when the size is
 * missing or unrecognized, so callers can invoke it unconditionally.
 *
 * @param body - the description body (already footer-appended)
 * @param size - the product's stored size value (US-letter scale)
 * @param locale - language of the header label
 * @param condition - the product's condition; appended to the header line
 */
export function prependSizeHeader(
  body: string,
  size: string | null | undefined,
  locale: "es" | "en",
  condition?: ProductCondition | null,
): string {
  const header = formatSizeHeader(size, locale, condition);
  if (!header) return body;
  const trimmedBody = body.trim();
  if (!trimmedBody) return header;
  return `${header}${HEADER_SEPARATOR}${trimmedBody}`;
}
