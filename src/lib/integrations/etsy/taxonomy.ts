/**
 * Curated short-list of Etsy taxonomy nodes for a women's vintage
 * clothing shop. The AI step picks one of these per product;
 * users can also pick manually on the flat edit form.
 *
 * IDs sourced from Etsy's live `/seller-taxonomy/nodes` endpoint —
 * regenerate via `pnpm etsy:taxonomy` (script in
 * `scripts/fetch-etsy-taxonomy.ts`). Vintage is NOT a Etsy
 * subtree: vintage items use the regular Clothing > Women's
 * Clothing leaves and signal "vintage" via `when_made = <decade>`
 * on the listing payload.
 *
 * Two keys lack a dedicated Etsy leaf:
 *   - `womens_outerwear_trench` → reuses Jackets & Coats (507).
 *   - `womens_clothing_sets` → reuses Jumpsuits & Rompers (509),
 *     Etsy's closest catch-all for two-piece coordinated sets.
 */

export type EtsyTaxonomyEntry = {
  /** Internal stable key (English, snake_case). Used as the
   *  i18n lookup key under `m.products.etsyTaxonomies.*`. */
  key: string;
  /** Etsy `taxonomy_id` from /seller-taxonomy/nodes. */
  id: number;
};

export const ETSY_TAXONOMIES: EtsyTaxonomyEntry[] = [
  { key: "womens_dresses", id: 505 },
  { key: "womens_skirts", id: 536 },
  { key: "womens_tops_and_tees", id: 553 },
  { key: "womens_sweaters", id: 548 },
  { key: "womens_jackets_and_coats", id: 507 },
  { key: "womens_pants", id: 1835 },
  { key: "womens_jeans", id: 508 },
  { key: "womens_shorts", id: 1837 },
  { key: "womens_jumpsuits_and_rompers", id: 509 },
  { key: "womens_bodysuits", id: 503 },
  { key: "womens_intimates_corsets", id: 517 },
  { key: "womens_outerwear_trench", id: 507 },
  { key: "womens_clothing_sets", id: 509 },
];

const BY_ID = new Map<number, EtsyTaxonomyEntry>(
  ETSY_TAXONOMIES.map((e) => [e.id, e]),
);
const BY_KEY = new Map<string, EtsyTaxonomyEntry>(
  ETSY_TAXONOMIES.map((e) => [e.key, e]),
);

export function getTaxonomyById(
  id: number,
): EtsyTaxonomyEntry | undefined {
  return BY_ID.get(id);
}

export function getTaxonomyByKey(
  key: string,
): EtsyTaxonomyEntry | undefined {
  return BY_KEY.get(key);
}
