import "server-only";

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
 * with a 400 if you send JSON). Array values are repeated with the
 * same key (e.g. `tags=foo&tags=bar`).
 */
function toFormUrlEncoded(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null) continue;
        params.append(key, String(item));
      }
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

export const __testing = { toFormUrlEncoded };
