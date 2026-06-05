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

/** One sold line item within a receipt. Carries the `listing_id`. */
export type ReceiptTransaction = {
  transaction_id: number;
  listing_id: number;
  quantity?: number;
};

/** A paid order. `created_timestamp` is unix seconds. */
export type Receipt = {
  receipt_id: number;
  created_timestamp: number;
  transactions: ReceiptTransaction[];
};

export type GetShopReceiptsOptions = {
  /** Only paid receipts (a sale, not an abandoned cart). */
  wasPaid?: boolean;
  /** Unix-seconds watermark — only receipts created at/after this. */
  minCreated?: number;
  limit?: number;
  offset?: number;
};

/**
 * GET /shops/{shop_id}/receipts
 * Reads recent orders shop-wide. The inbound sync poll calls this once
 * per cycle and matches `transactions[].listing_id` against published
 * products to detect sales (Etsy has no push webhooks). Requires the
 * `transactions_r` OAuth scope.
 */
export async function getShopReceipts(
  shopId: number,
  opts: GetShopReceiptsOptions,
  store?: TokenStore,
): Promise<Receipt[]> {
  const params = new URLSearchParams();
  if (opts.wasPaid !== undefined) params.set("was_paid", String(opts.wasPaid));
  if (opts.minCreated !== undefined) {
    params.set("min_created", String(opts.minCreated));
  }
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const qs = params.toString();

  const res = await etsyFetch(
    `/shops/${shopId}/receipts${qs ? `?${qs}` : ""}`,
    { method: "GET" },
    store,
  );
  const data = await unwrap<{ results: Receipt[] }>(res, "getShopReceipts");
  return data.results ?? [];
}

/**
 * GET /shops/{shop_id}/listings/{listing_id}
 * Reads a single listing's authoritative state. Used by the inbound
 * sync poll to pull Etsy-side price changes (manual edits / discounts)
 * back into the admin. Etsy has no push webhooks, so this is polled.
 */
export async function getListing(
  shopId: number,
  listingId: number,
  store?: TokenStore,
): Promise<ListingDetail> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}`,
    { method: "GET" },
    store,
  );
  return unwrap<ListingDetail>(res, "getListing");
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
 * GET /shops/{shop_id}/listings/{listing_id}/images
 * Lists the listing's current images. Used by the update flow to
 * delete prior images before re-uploading the canonical R2 set.
 */
export async function listListingImages(
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
    "listListingImages",
  );
  return data.results ?? [];
}

/**
 * DELETE /shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}
 */
export async function deleteListingImage(
  shopId: number,
  listingId: number,
  listingImageId: number,
  store?: TokenStore,
): Promise<void> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/images/${listingImageId}`,
    { method: "DELETE" },
    store,
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Etsy deleteListingImage failed: ${res.status} ${body}`,
    );
  }
}

/**
 * GET /shops/{shop_id}/listings/{listing_id}/videos
 */
export async function listListingVideos(
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
    "listListingVideos",
  );
  return data.results ?? [];
}

/**
 * DELETE /shops/{shop_id}/listings/{listing_id}/videos/{video_id}
 */
export async function deleteListingVideo(
  shopId: number,
  listingId: number,
  videoId: number,
  store?: TokenStore,
): Promise<void> {
  const res = await etsyFetch(
    `/shops/${shopId}/listings/${listingId}/videos/${videoId}`,
    { method: "DELETE" },
    store,
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Etsy deleteListingVideo failed: ${res.status} ${body}`,
    );
  }
}

export const __testing = { toFormUrlEncoded };
