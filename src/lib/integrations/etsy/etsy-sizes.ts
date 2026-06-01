/**
 * Etsy "Women's Clothing (US Letter)" size scale.
 *
 * Etsy size attributes attach to a listing via the per-taxonomy
 * property endpoint (`PUT /shops/{shop_id}/listings/{listing_id}/properties/{property_id}`)
 * — the publish processor will eventually call that endpoint. The
 * picker on the new-product form constrains the user to one of these
 * values so the operator can't free-text a size Etsy will reject.
 */

export const ETSY_SIZES = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "1X",
  "2X",
  "3X",
] as const;

export type EtsySize = (typeof ETSY_SIZES)[number];

const ETSY_SIZE_SET = new Set<string>(ETSY_SIZES);

export function isEtsySize(value: unknown): value is EtsySize {
  return typeof value === "string" && ETSY_SIZE_SET.has(value);
}
