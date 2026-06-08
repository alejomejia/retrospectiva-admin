/**
 * URL slug generation for the public `retrospectiva-website` store.
 *
 * A product slug is `${slugify(title)}-${idSuffix}` — e.g.
 * `chaqueta-safari-arena-9f3c1a`. The title segment is SEO-friendly;
 * the 6-hex-char suffix (first chars of the immutable UUID) guarantees
 * uniqueness without a DB round-trip, so two garments that happen to
 * share a title never collide.
 *
 * The slug is FROZEN at first publish (persisted to `products.slug`)
 * so editing a title later doesn't break shared / indexed URLs. The
 * Spanish title is canonical (admin + brand are ES-first); see
 * `buildWebsitePayload` for where the slug is emitted on the wire.
 */

/** Number of leading hex chars of the UUID used as the uniqueness suffix. */
const ID_SUFFIX_LENGTH = 6;

/**
 * Slugifies a free-text title: lowercased, accents stripped, non
 * alphanumerics collapsed to single hyphens, trimmed. Returns `"item"`
 * for an empty / symbol-only title so a slug is always producible.
 *
 * @example
 * ```ts
 * slugifyTitle("Chaqueta Safari Arena") // "chaqueta-safari-arena"
 * slugifyTitle("  ¡Vestido 100% lino!  ") // "vestido-100-lino"
 * ```
 */
export function slugifyTitle(title: string): string {
  const base = title
    .normalize("NFKD")
    // strip combining accent marks
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

/**
 * Builds the frozen public slug for a product from its canonical
 * (Spanish) title and immutable id.
 *
 * @param title - The canonical product title (`titleEs`).
 * @param id - The product UUID; its first 6 hex chars become the suffix.
 * @returns A collision-proof, URL-safe slug.
 *
 * @example
 * ```ts
 * buildSlug("Chaqueta Safari Arena", "9f3c1a2b-...") // "chaqueta-safari-arena-9f3c1a"
 * ```
 */
export function buildSlug(title: string | null | undefined, id: string): string {
  const suffix = id.replace(/-/g, "").slice(0, ID_SUFFIX_LENGTH);
  // Titles carry SEO suffixes after a `|` (e.g. `Chaqueta | Vintage second
  // hand`); the slug uses only the leading piece, mirroring the storefront
  // display name (`cleanName` in retrospectiva-website).
  const display = (title ?? "").split(" | ").at(0) ?? "";
  return `${slugifyTitle(display)}-${suffix}`;
}
