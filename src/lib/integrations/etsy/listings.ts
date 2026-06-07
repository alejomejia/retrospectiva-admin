// NOTE: no `import "server-only"` here — this module is on the
// worker's import chain (`publish.ts` → `listings.ts`) and `tsx`
// has no React server-condition shim. Client-bundle protection
// comes from this file being imported only by server actions /
// route handlers / the worker; no client component pulls it.
// See `docs/overview/project-conventions.md` §1.

import { etsyFetch, type TokenStore } from "./client";

/**
 * Etsy Open API v3 listing endpoints. Each helper hides the
 * content-type quirks (form-urlencoded for listing create/update,
 * multipart for image/video upload, JSON for translations) so the
 * publish worker reads as a flat sequence of well-typed steps.
 *
 * Etsy API references:
 *   createDraftListing       — POST /application/shops/{shop_id}/listings
 *   updateListing            — PUT  /application/shops/{shop_id}/listings/{listing_id}
 *   uploadListingImage       — POST /application/shops/{shop_id}/listings/{listing_id}/images
 *   uploadListingVideo       — POST /application/shops/{shop_id}/listings/{listing_id}/videos
 *   upsertListingTranslation — PUT  /application/shops/{shop_id}/listings/{listing_id}/translations/{language}
 */

/** Subset of `who_made` we ever set for this shop (vintage reseller). */
export type WhoMade = "i_did" | "someone_else" | "collective";

export type WhenMade =
  | "made_to_order"
  | "2020_2025"
  | "2010_2019"
  | "2006_2009"
  | "before_2006"
  | "2000_2005"
  | "1990s"
  | "1980s"
  | "1970s"
  | "1960s"
  | "1950s"
  | "1940s"
  | "1930s"
  | "1920s"
  | "1910s"
  | "1900s"
  | "1800s"
  | "1700s"
  | "before_1700";

export type CreateDraftListingPayload = {
  quantity: number;
  title: string;
  description: string;
  price: number;
  who_made: WhoMade;
  when_made: WhenMade;
  taxonomy_id: number;
  shipping_profile_id?: number;
  return_policy_id?: number;
  readiness_state_id?: number;
  /**
   * Etsy `primary_color` / `secondary_color` lowercase vocabulary —
   * see `etsy-colors.ts` for the full list.
   */
  primary_color?: string;
  secondary_color?: string;
  /**
   * Etsy "shop highlight" rank. `1` makes the listing one of the
   * shop's featured products (cap of 4 enforced by Etsy itself).
   */
  featured_rank?: number;
  materials?: string[];
  tags?: string[];
  shop_section_id?: number;
  type?: "physical" | "download" | "both";
  is_supply?: boolean;
  is_personalizable?: boolean;
  is_taxable?: boolean;
  should_auto_renew?: boolean;
};

export type UpdateListingPayload = Partial<CreateDraftListingPayload> & {
  state?: "draft" | "active" | "inactive";
  image_ids?: number[];
};

export type Listing = {
  listing_id: number;
  state: string;
  url?: string;
};

/**
 * Etsy money object. `amount / divisor` is the human price; e.g.
 * `{ amount: 4200, divisor: 100 }` is `42.00`.
 */
export type EtsyPrice = {
  amount: number;
  divisor: number;
  currency_code: string;
};

/**
 * Full listing as returned by GET — the fields the inbound sync poll
 * reads back from Etsy (price + lifecycle state + stock).
 */
export type ListingDetail = {
  listing_id: number;
  state: string;
  quantity: number;
  price: EtsyPrice;
  url?: string;
  title?: string;
};

export type ListingImage = {
  listing_id: number;
  listing_image_id: number;
  rank: number;
  alt_text: string | null;
};

export type ListingVideo = {
  listing_id: number;
  video_id: number;
  video_state: string;
};

export type ListingTranslation = {
  language: string;
  title: string;
  description: string;
  tags?: string[];
};

/**
 * Etsy v3 expects `application/x-www-form-urlencoded` on the
 * listing create/update endpoints (not JSON — silently fails open
 * with a 400 if you send JSON). Array values are sent as a single
 * comma-separated value (e.g. `tags=foo,bar`); repeating the same
 * key silently keeps only the last value. NOTE: Etsy itself
 * disallows commas inside tag / material strings, so this CSV join
 * is unambiguous.
 */
function toFormUrlEncoded(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v));
      if (items.length > 0) params.append(key, items.join(","));
    } else if (typeof value === "boolean") {
      params.append(key, value ? "true" : "false");
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

async function unwrap<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Etsy ${endpoint} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

export async function createDraftListing(
  shopId: number,
  payload: CreateDraftListingPayload,
  store?: TokenStore,
): Promise<Listing> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(payload),
    },
    store,
  );
  return unwrap<Listing>(res, "createDraftListing");
}

/**
 * Convert an Etsy {@link EtsyPrice} to integer cents, matching the
 * `*_cents` columns the admin stores prices in. Rounds to the nearest
 * cent so odd divisors (e.g. `divisor: 4`) don't leak fractions.
 *
 * @example
 *   etsyPriceToCents({ amount: 4200, divisor: 100, currency_code: "USD" }) // 4200
 */
export function etsyPriceToCents(price: EtsyPrice): number {
  return Math.round((price.amount / price.divisor) * 100);
}

/**
 * GET /shops/{shop_id}/listings/featured
 * Returns the shop's currently-featured listings. Etsy caps featured
 * listings at 4 shop-wide, so the response is small and never needs
 * pagination. The publish flow uses this to avoid sending a
 * `featured_rank` once the cap is full (Etsy rejects the whole
 * listing create/update otherwise).
 */
export async function getFeaturedListings(
  shopId: number,
  store?: TokenStore,
): Promise<ListingDetail[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/featured`,
    { method: "GET" },
    store,
  );
  const data = await unwrap<{ results: ListingDetail[] }>(
    res,
    "getFeaturedListings",
  );
  return data.results ?? [];
}

export async function updateListing(
  shopId: number,
  listingId: number,
  patch: UpdateListingPayload,
  store?: TokenStore,
): Promise<Listing> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(patch),
    },
    store,
  );
  return unwrap<Listing>(res, "updateListing");
}

/**
 * GET /shops/{shop_id}/listings/{listing_id}/images
 * Lists the images currently attached to a listing. Used by the
 * resume path: when re-running a publish against an existing draft we
 * wipe its images first so the re-upload doesn't duplicate them.
 */
export async function getListingImages(
  shopId: number,
  listingId: number,
  store?: TokenStore,
): Promise<ListingImage[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/images`,
    { method: "GET" },
    store,
  );
  const data = await unwrap<{ results: ListingImage[] }>(
    res,
    "getListingImages",
  );
  return data.results ?? [];
}

/**
 * DELETE /shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}
 * Removes a single image from a listing. Etsy returns 204 No Content
 * on success, so there's no body to parse.
 */
export async function deleteListingImage(
  shopId: number,
  listingId: number,
  imageId: number,
  store?: TokenStore,
): Promise<void> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/images/${imageId}`,
    { method: "DELETE" },
    store,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Etsy deleteListingImage failed: ${res.status} ${body}`);
  }
}

/**
 * GET /shops/{shop_id}/listings/{listing_id}/videos
 * Lists the videos attached to a listing (Etsy allows at most one).
 * Used by the resume path to skip a duplicate video upload.
 */
export async function getListingVideos(
  shopId: number,
  listingId: number,
  store?: TokenStore,
): Promise<ListingVideo[]> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/videos`,
    { method: "GET" },
    store,
  );
  const data = await unwrap<{ results: ListingVideo[] }>(
    res,
    "getListingVideos",
  );
  return data.results ?? [];
}

export type UploadListingImageInput = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  rank?: number;
  altText?: string;
};

export async function uploadListingImage(
  shopId: number,
  listingId: number,
  input: UploadListingImageInput,
  store?: TokenStore,
): Promise<ListingImage> {
  const form = new FormData();
  // NOTE: Blob with explicit `type` is required — Etsy 400s if the
  // multipart part lacks a Content-Type header.
  form.append(
    "image",
    new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
    input.filename,
  );
  if (typeof input.rank === "number") form.append("rank", String(input.rank));
  if (input.altText) form.append("alt_text", input.altText);

  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/images`,
    { method: "POST", body: form },
    store,
  );
  return unwrap<ListingImage>(res, "uploadListingImage");
}

export type UploadListingVideoInput = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  name?: string;
};

export async function uploadListingVideo(
  shopId: number,
  listingId: number,
  input: UploadListingVideoInput,
  store?: TokenStore,
): Promise<ListingVideo> {
  const form = new FormData();
  form.append(
    "video",
    new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
    input.filename,
  );
  if (input.name) form.append("name", input.name);

  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/videos`,
    { method: "POST", body: form },
    store,
  );
  return unwrap<ListingVideo>(res, "uploadListingVideo");
}

export type UpsertTranslationInput = {
  title: string;
  description: string;
  tags?: string[];
};

export async function upsertListingTranslation(
  shopId: number,
  listingId: number,
  language: string,
  fields: UpsertTranslationInput,
  store?: TokenStore,
): Promise<ListingTranslation> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/translations/${language}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(fields),
    },
    store,
  );
  return unwrap<ListingTranslation>(res, "upsertListingTranslation");
}

/**
 * A single value option for a taxonomy property (e.g. the color
 * "Black" → `value_id` 1). `scale_id` is set only on scaled
 * properties like Size.
 */
export type TaxonomyPropertyValue = {
  value_id: number;
  name: string;
  scale_id?: number | null;
};

/**
 * A measurement scale for a scaled property (e.g. Size → "Women's
 * US Letter"). `display_name` is what the operator would recognize.
 */
export type TaxonomyPropertyScale = {
  scale_id: number;
  display_name: string;
  description?: string;
};

/**
 * One property available on a taxonomy node (Primary color, Size, …),
 * with the value vocabulary and (for scaled properties) the scales.
 * Property ids and value ids are NOT universal — they depend on the
 * listing's taxonomy, so they must be resolved per-taxonomy rather
 * than hardcoded. See `getPropertiesByTaxonomyId`.
 */
export type TaxonomyProperty = {
  property_id: number;
  name: string;
  display_name: string;
  scales: TaxonomyPropertyScale[];
  is_required: boolean;
  supports_attributes: boolean;
  supports_variations: boolean;
  possible_values: TaxonomyPropertyValue[];
};

/**
 * GET /seller-taxonomy/nodes/{taxonomy_id}/properties
 * Returns the properties (color, size, …) valid for a taxonomy node,
 * each with its value vocabulary. The publish flow uses this to
 * translate our stored color/size strings into the `value_id` /
 * `scale_id` pairs Etsy's listing-property endpoint requires.
 */
export async function getPropertiesByTaxonomyId(
  taxonomyId: number,
  store?: TokenStore,
): Promise<TaxonomyProperty[]> {
  const res = await etsyFetch(
    `/seller-taxonomy/nodes/${taxonomyId}/properties`,
    { method: "GET" },
    store,
  );
  const data = await unwrap<{ results: TaxonomyProperty[] }>(
    res,
    "getPropertiesByTaxonomyId",
  );
  return data.results ?? [];
}

export type UpdateListingPropertyInput = {
  /** Human-readable value strings, parallel to `valueIds`. */
  values: string[];
  /** Etsy `value_id`s for {@link values}, in the same order. */
  valueIds: number[];
  /** Required for scaled properties (e.g. Size); omit for color. */
  scaleId?: number;
};

/**
 * PUT /shops/{shop_id}/listings/{listing_id}/properties/{property_id}
 * Sets a single attribute (color, size, …) on a listing. Etsy needs
 * both the `values` (display strings) and the matching `value_ids`,
 * plus a `scale_id` for scaled properties.
 */
export async function updateListingProperty(
  shopId: number,
  listingId: number,
  propertyId: number,
  input: UpdateListingPropertyInput,
  store?: TokenStore,
): Promise<void> {
  const body: Record<string, unknown> = {
    values: input.values,
    value_ids: input.valueIds,
  };
  if (typeof input.scaleId === "number") body.scale_id = input.scaleId;
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/properties/${propertyId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(body),
    },
    store,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Etsy updateListingProperty failed: ${res.status} ${text}`);
  }
}

export const __testing = { toFormUrlEncoded };
