import "server-only";

import { etsyFetch, type TokenStore } from "./client";

/**
 * Read-only Etsy v3 endpoints that expose the shop's pre-configured
 * defaults (shipping rates, return terms, storefront sections).
 *
 * Each list endpoint wraps the results in `{ count, results }` —
 * Etsy's standard pagination envelope. We unwrap to `results[]`
 * since callers never care about pagination at this volume
 * (Retrospectiva will realistically have 1–3 shipping profiles,
 * 1–2 return policies, and well under 25 sections).
 *
 * Etsy API references:
 *   https://developers.etsy.com/documentation/reference/#operation/getShopShippingProfiles
 *   https://developers.etsy.com/documentation/reference/#operation/getShopReturnPolicies
 *   https://developers.etsy.com/documentation/reference/#operation/getShopSections
 */

type EtsyListEnvelope<T> = {
  count: number;
  results: T[];
};

export type ShippingProfile = {
  shipping_profile_id: number;
  title: string;
  origin_country_iso?: string;
  min_processing_days?: number;
  max_processing_days?: number;
};

export type ReturnPolicy = {
  return_policy_id: number;
  accepts_returns: boolean;
  accepts_exchanges: boolean;
  return_deadline?: number;
};

export type ShopSection = {
  shop_section_id: number;
  title: string;
  active_listing_count?: number;
};

async function unwrap<T>(res: Response, endpoint: string): Promise<T[]> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Etsy ${endpoint} failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as EtsyListEnvelope<T>;
  return json.results ?? [];
}

/**
 * List the shop's configured shipping profiles. The user creates
 * these manually in Etsy's web UI under *Shop Manager → Settings →
 * Shipping settings*. Used to populate the default-shipping picker
 * on `/settings/integrations`.
 *
 * @example
 *   const profiles = await listShippingProfiles(123);
 *   // [{ shipping_profile_id: 5001, title: "Standard EU", … }]
 */
export async function listShippingProfiles(
  shopId: number,
  store?: TokenStore,
): Promise<ShippingProfile[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/shipping-profiles`,
    {},
    store,
  );
  return unwrap<ShippingProfile>(res, "shipping-profiles");
}

/**
 * List the shop's configured return policies. Created in Etsy's web
 * UI under *Shop Manager → Settings → Policy settings*. Etsy
 * requires every listing to reference one, so the admin needs at
 * least one configured to publish.
 */
export async function listReturnPolicies(
  shopId: number,
  store?: TokenStore,
): Promise<ReturnPolicy[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/policies/return`,
    {},
    store,
  );
  return unwrap<ReturnPolicy>(res, "policies/return");
}

/**
 * List the shop's storefront sections (e.g. "Vestidos",
 * "Abrigos"). Not consumed by `/settings/integrations` — sections are
 * per-listing, not shop-wide. This helper exists for the product
 * form / Phase 6 AI to pick the right section per product.
 */
export async function listShopSections(
  shopId: number,
  store?: TokenStore,
): Promise<ShopSection[]> {
  const res = await etsyFetch(`/shops/${shopId}/sections`, {}, store);
  return unwrap<ShopSection>(res, "sections");
}
