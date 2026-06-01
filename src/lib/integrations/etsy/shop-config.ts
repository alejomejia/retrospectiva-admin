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

/**
 * Etsy "processing profile" — required on every physical listing as
 * of the v3 readiness-states migration. Each row describes a
 * min/max processing window the seller has pre-defined; the operator
 * picks one in `/settings/integrations` and the publish processor
 * stamps it onto the `createDraftListing` payload as
 * `readiness_state_id`.
 */
export type ReadinessStateDefinition = {
  readiness_state_id: number;
  shop_id?: number;
  readiness_state?: string;
  min_processing_days: number;
  max_processing_days: number;
  /** Pre-formatted by Etsy, e.g. "1-2 days". Prefer when present. */
  processing_days_display_label?: string;
  is_deleted?: boolean;
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
 * List the shop's pre-defined readiness states (processing profiles).
 * Created in Etsy's web UI under *Shop Manager → Settings → Production
 * settings → Processing profiles*. Etsy made `readiness_state_id`
 * required on `createDraftListing` for physical listings, so the
 * admin needs at least one configured to publish.
 *
 * Endpoint: `GET /shops/{shop_id}/readiness-state-definitions`.
 * Deleted definitions are filtered server-side; we additionally
 * drop any `is_deleted=true` rows defensively.
 */
export async function listReadinessStates(
  shopId: number,
  store?: TokenStore,
): Promise<ReadinessStateDefinition[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/readiness-state-definitions`,
    {},
    store,
  );
  const rows = await unwrap<ReadinessStateDefinition>(
    res,
    "readiness-state-definitions",
  );
  return rows.filter((r) => !r.is_deleted);
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
