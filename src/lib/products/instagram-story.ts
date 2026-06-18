/**
 * Pure helpers that derive the overlay copy for the Instagram-story
 * export from a product row. Kept free of React / R2 / DB so they unit
 * test in isolation and stay reusable by the route handler.
 */

import type { Product } from "@/lib/db/schema";

import { formatSizeBadge } from "./size-conversion";
import {
  DEFAULT_MARKUP_PERCENT,
  effectiveListCents,
  inflatedListCents,
} from "./pricing";

/** Joiner between eyebrow segments (era · size), matching the mockup. */
const EYEBROW_SEPARATOR = " · ";

/**
 * Top eyebrow line, e.g. `1980S · S · EU 36 · UK 8 · US 4`. Composed of
 * the era followed by the full size conversion, each included only when
 * its source field is present (so a product missing the era or the size
 * still renders a clean line, or `null` when both are absent and the
 * caller can omit the element entirely).
 *
 * @param product - the product row
 */
export function storyEyebrow(
  product: Pick<Product, "etsyWhenMade" | "size">,
): string | null {
  const segments: string[] = [];

  if (product.etsyWhenMade && product.etsyWhenMade.trim() !== "") {
    // `1980s` → `1980S`, `before_1950` → `BEFORE 1950`.
    segments.push(product.etsyWhenMade.replace(/_/g, " ").toUpperCase());
  }

  const sizeBadge = formatSizeBadge(product.size, EYEBROW_SEPARATOR);
  if (sizeBadge) segments.push(sizeBadge);

  return segments.length > 0 ? segments.join(EYEBROW_SEPARATOR) : null;
}

/** Fields the price computation reads off a product row. */
type StoryPriceFields = Pick<
  Product,
  | "basePriceCents"
  | "markupPercentOverride"
  | "listPriceCentsOverride"
  | "discountPercent"
>;

/**
 * The real price (in cents) a buyer pays on Etsy, **with the promotion
 * applied** — i.e. what the story should advertise — or `null` when the
 * product has no decided price yet (draft).
 *
 * Mirrors the Etsy boundary: `effectiveListCents` is inflated to the
 * charm-rounded list price actually set on the listing
 * (`inflatedListCents`), and when a `discountPercent` sale is active the
 * matching Shop Manager promo is applied on top, landing on the price
 * the buyer is charged. Without a discount this is just the charm list.
 *
 * @param product - the product row (base price, overrides, discount)
 * @param shopMarkupPercent - shop-wide markup, e.g. `etsy_oauth.markupPercent`
 */
export function storyPriceCents(
  product: StoryPriceFields,
  shopMarkupPercent: number,
): number | null {
  const list = effectiveListCents({
    basePriceCents: product.basePriceCents,
    markupPercentOverride: product.markupPercentOverride,
    listPriceCentsOverride: product.listPriceCentsOverride,
    shopMarkupPercent: shopMarkupPercent ?? DEFAULT_MARKUP_PERCENT,
  });
  if (list === null) return null;

  const discount = product.discountPercent;
  // The charm list price set on the Etsy listing (inflated to absorb the
  // sale so the post-promo price lands near the target list).
  const listedCents = inflatedListCents(list, discount);
  if (discount !== null && discount > 0 && discount < 100) {
    return Math.round(listedCents * (1 - discount / 100));
  }
  return listedCents;
}

/**
 * Formats a EUR cents value as a display price, e.g. `8599` → `€85.99`.
 * Whole-euro amounts drop the `.00` (`8500` → `€85`).
 *
 * @param cents - amount in euro cents
 */
export function formatEurFromCents(cents: number): string {
  const euros = cents / 100;
  const body = Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
  return `€${body}`;
}

/**
 * Convenience: the formatted price label for a product, or `null` when
 * undecided (so the template omits the price element).
 */
export function storyPriceLabel(
  product: StoryPriceFields,
  shopMarkupPercent: number,
): string | null {
  const cents = storyPriceCents(product, shopMarkupPercent);
  return cents === null ? null : formatEurFromCents(cents);
}
