import type { Product } from "@/lib/db/schema";
import type { ProductSettings } from "./settings";

/**
 * Joiner between a listing description and its footer: a blank line, a
 * `---` divider rule, then another blank line, so the shared boilerplate
 * footer reads as a distinct block below the AI description.
 */
const FOOTER_SEPARATOR = "\n\n---\n\n";

export type ListingFooter = { es: string; en: string };

type FooterOverrideFields = Pick<
  Product,
  "listingFooterEsOverride" | "listingFooterEnOverride"
>;

type FooterSettingsFields = Pick<
  ProductSettings,
  "listingFooterEs" | "listingFooterEn"
>;

/**
 * Resolves the effective listing footer for a product. A non-empty
 * per-product ES override wins as a pair (its EN counterpart is the
 * cached translation written at save time); otherwise the shop-wide
 * `product_settings` footer is used. Both members are trimmed and may
 * be empty strings, meaning "append nothing".
 *
 * The footer is intentionally resolved at the payload boundary and
 * never stored in the description columns, so it stays out of the AI
 * enrich prompt and the ES→EN translation queue.
 */
export function resolveListingFooter(
  product: FooterOverrideFields,
  settings: FooterSettingsFields,
): ListingFooter {
  const overrideEs = (product.listingFooterEsOverride ?? "").trim();
  if (overrideEs) {
    return {
      es: overrideEs,
      en: (product.listingFooterEnOverride ?? "").trim(),
    };
  }
  return {
    es: (settings.listingFooterEs ?? "").trim(),
    en: (settings.listingFooterEn ?? "").trim(),
  };
}

/**
 * Appends `footer` to a listing `body`, separated by a `---` divider
 * rule on its own line. Empty footer (or empty body) is handled
 * gracefully — no dangling divider — so callers can pass the resolved
 * footer unconditionally.
 */
export function appendListingFooter(body: string, footer: string): string {
  const trimmedFooter = footer.trim();
  if (!trimmedFooter) return body;
  const trimmedBody = body.trim();
  if (!trimmedBody) return trimmedFooter;
  return `${trimmedBody}${FOOTER_SEPARATOR}${trimmedFooter}`;
}
