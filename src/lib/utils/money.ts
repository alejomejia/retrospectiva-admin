/**
 * Money string ↔ integer-cents conversion + locale-aware formatting.
 *
 * The single source of truth for handling money in the app. The regex
 * defines the on-the-wire shape (a positive number with up to two
 * decimals); the parser and formatter both honor it. Any form, action,
 * or page that touches money should import from here — never inline
 * `cents / 100` or hand-roll `parseFloat` arithmetic.
 */

/**
 * Two-decimal positive money string, like `"49"` or `"49.99"`.
 * Re-exported for use as a zod `.regex(MONEY_STRING_RE, …)` rule so the
 * form's accepted shape and the parser's accepted shape stay locked.
 */
export const MONEY_STRING_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Format integer cents as a localized currency string.
 *
 * @example
 *   formatCents(4999, "EUR") // "€49.99"
 *   formatCents(120000, "EUR") // "€1,200.00"
 */
export function formatCents(
  cents: number,
  currency: string = "EUR",
  locale: string = "en-IE",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Convert a validated money string (e.g. `"49.99"`) to integer cents.
 * Always go through this on the server boundary — never store decimals.
 *
 * @example
 *   priceEurToCents("49.99") // 4999
 *   priceEurToCents("1.23") // 123 — Math.round dodges 122.999… float drift
 */
export function priceEurToCents(priceEur: string): number {
  return Math.round(parseFloat(priceEur) * 100);
}

/**
 * Inverse of `priceEurToCents`. Useful for prefilling an editable form
 * with a value coming from the database.
 *
 * @example
 *   centsToPriceEur(4999) // "49.99"
 */
export function centsToPriceEur(cents: number): string {
  return (cents / 100).toFixed(2);
}
