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
