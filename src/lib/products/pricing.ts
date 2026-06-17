/**
 * Pricing math for products. Two key numbers:
 *
 * - `basePriceCents` — what the user wants to earn from a sale.
 * - effective list price (computed) — what gets sent to Etsy and
 *   shown on the public website. By default `base × (1 + markup/100)`,
 *   with two overrides: a per-product markup override or a per-product
 *   absolute list-price override.
 *
 * The shop-wide markup lives on `etsy_oauth.markupPercent` (default 30).
 * Per-product overrides live on `products`.
 */

/** Fallback when there's no row in `etsy_oauth` yet (pre-connection). */
export const DEFAULT_MARKUP_PERCENT = 30;

/**
 * Hard fallback discount percentage. The live shop default lives on
 * `product_settings.default_discount_percent` (operator-editable) and
 * is what the form's sale toggle actually writes; this constant only
 * backstops the settings UI placeholder when no row exists yet. The
 * `products.discount_percent` column accepts any 1–99 per-product rate.
 */
export const DEFAULT_DISCOUNT_PERCENT = 25;

export type PricingInputs = {
  /** Base price in cents. Null while the user hasn't filled it in. */
  basePriceCents: number | null;
  /** Per-product markup override (`%`), or null to inherit the shop value. */
  markupPercentOverride?: number | null;
  /**
   * Per-product absolute list-price override in cents, or null to use
   * the markup-based computation.
   */
  listPriceCentsOverride?: number | null;
  /** Shop-wide markup percentage (typically 30). */
  shopMarkupPercent: number;
};

/**
 * Returns the effective Etsy list price in cents. Resolution order:
 *
 * 1. `listPriceCentsOverride` if set (takes precedence over everything).
 * 2. `basePriceCents * (1 + (markupOverride ?? shop) / 100)`, rounded
 *    to the nearest cent.
 *
 * Returns `null` if `basePriceCents` is null and no override is set —
 * draft state where pricing isn't decided yet.
 */
export function effectiveListCents(inputs: PricingInputs): number | null {
  if (
    inputs.listPriceCentsOverride !== null &&
    inputs.listPriceCentsOverride !== undefined
  ) {
    return inputs.listPriceCentsOverride;
  }
  if (inputs.basePriceCents === null || inputs.basePriceCents === undefined) {
    return null;
  }
  const markup =
    inputs.markupPercentOverride ??
    inputs.shopMarkupPercent ??
    DEFAULT_MARKUP_PERCENT;
  return Math.round(inputs.basePriceCents * (1 + markup / 100));
}

/**
 * Round a cents value UP to the next `.99` (charm price). Etsy
 * listings are always priced at `X.99` per the shop convention, so
 * the publish mapper applies this at the Etsy boundary — the
 * canonical `basePriceCents` stays exact for accounting.
 *
 * Examples (cents):
 *   8500 → 8599 (85.00 → 85.99)
 *   8550 → 8599 (85.50 → 85.99)
 *   8599 → 8599 (already a charm price, no change)
 *   8600 → 8699 (86.00 → 86.99)
 */
export function roundUpToCharmCents(cents: number): number {
  return Math.floor(cents / 100) * 100 + 99;
}

/**
 * Charm-priced list value for a (possibly discounted) listing.
 *
 * Without a discount this is just `roundUpToCharmCents(listCents)`.
 *
 * With a discount the value is inflated so that applying a
 * `discountPercent` sale on top lands the buyer back near the
 * un-discounted list price: `list / (1 - p/100)`, then charm-rounded.
 * Etsy can't create the sale via API, so the operator runs a matching
 * `%` sale in Shop Manager; the website renders this as the struck-out
 * "compare-at" price.
 *
 * Examples (cents, p = 25):
 *   13000 → 17399  (130.00 → 173.32 → charm 173.99; 25% off ≈ 130.49)
 *   13000, p = null/0 → 13099  (no inflation, just charm)
 */
export function inflatedListCents(
  listCents: number,
  discountPercent: number | null | undefined,
): number {
  if (
    discountPercent === null ||
    discountPercent === undefined ||
    discountPercent <= 0 ||
    discountPercent >= 100
  ) {
    return roundUpToCharmCents(listCents);
  }
  return roundUpToCharmCents(
    Math.round(listCents / (1 - discountPercent / 100)),
  );
}

/**
 * The effective markup percentage in use for a product, with the same
 * resolution order as `effectiveListCents`. Returns `null` when the
 * list price is purely overridden (no markup math involved).
 */
export function effectiveMarkupPercent(
  inputs: Pick<
    PricingInputs,
    "markupPercentOverride" | "shopMarkupPercent" | "listPriceCentsOverride"
  >,
): number | null {
  if (
    inputs.listPriceCentsOverride !== null &&
    inputs.listPriceCentsOverride !== undefined
  ) {
    return null;
  }
  return (
    inputs.markupPercentOverride ??
    inputs.shopMarkupPercent ??
    DEFAULT_MARKUP_PERCENT
  );
}
