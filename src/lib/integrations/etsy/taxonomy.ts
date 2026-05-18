/**
 * Curated short-list of Etsy taxonomy nodes for a women's vintage
 * clothing shop. The AI step picks one of these per product;
 * users can also pick manually on the flat edit form.
 *
 * The numeric `id` is Etsy's `taxonomy_id` from
 * `/seller-taxonomy/nodes`. The placeholder zeros below need to be
 * replaced with real IDs once we hit the live Etsy taxonomy
 * endpoint (Phase 4c / Task 6). Until then, the value is recorded
 * so the UI flow works, and Task 6 wires the lookup.
 *
 * TODO(taxonomy): replace `0` IDs with the real values fetched
 * from `/v3/application/seller-taxonomy/nodes`.
 */

export type EtsyTaxonomyEntry = {
  /** Internal stable key (English, snake_case). Used as the
   *  i18n lookup key under `m.products.etsyTaxonomies.*`. */
  key: string;
  /** Etsy `taxonomy_id`. `0` = placeholder pending taxonomy import. */
  id: number;
};

export const ETSY_TAXONOMIES: EtsyTaxonomyEntry[] = [
  { key: "womens_dresses", id: 0 },
  { key: "womens_skirts", id: 0 },
  { key: "womens_tops_and_tees", id: 0 },
  { key: "womens_sweaters", id: 0 },
  { key: "womens_jackets_and_coats", id: 0 },
  { key: "womens_pants", id: 0 },
  { key: "womens_jeans", id: 0 },
  { key: "womens_shorts", id: 0 },
  { key: "womens_jumpsuits_and_rompers", id: 0 },
  { key: "womens_bodysuits", id: 0 },
  { key: "womens_intimates_corsets", id: 0 },
  { key: "womens_outerwear_trench", id: 0 },
  { key: "womens_clothing_sets", id: 0 },
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
