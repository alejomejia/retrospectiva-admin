# Etsy listing payload — what we can send

A reference for the entire shape of a listing on Etsy's Open API v3. This
document exists to inform the scope of our product form: every field the
admin captures should map cleanly to one of these payload slots, and
every payload slot we ignore should be a conscious choice.

Etsy's API is the source of truth — when in doubt, check the live docs at
<https://developer.etsy.com/documentation/reference/>. The types below
mirror the API as of v3 (2024-2026 era).

---

## 1 · How a listing is composed

A "listing" on Etsy is not a single object — it's a small graph of
resources. To publish a product you'll touch several endpoints in order:

```
                   ┌─────────────────────┐
                   │   Draft Listing     │  ← createDraftListing
                   │  (title, price,     │
                   │   description, …)   │
                   └─┬─────┬───┬─────┬───┘
                     │     │   │     │
   ┌─────────────────┘     │   │     └──────────────────┐
   │                       │   │                        │
   ▼                       ▼   ▼                        ▼
┌──────────┐     ┌──────────────┐     ┌────────────────────────┐
│  Images  │     │   Inventory  │     │     Translations       │
│  (1..10) │     │  + property  │     │  (per locale, optional)│
│  POST    │     │  + offerings │     │   PUT per language     │
└──────────┘     └──────────────┘     └────────────────────────┘
   │
   ▼
┌──────────┐
│  Video   │  ← uploadListingVideo (1 only)
│  (max 1) │
└──────────┘

                    finally:
                  ┌──────────────┐
                  │  setState    │  ← update state to "active"
                  │ → "active"   │
                  └──────────────┘
```

Practical sequence:

1. **Create draft** with title, price, description, taxonomy, `who_made`,
   `when_made`, quantity, materials, tags. **State stays `draft`.**
2. **Upload images** one at a time (multipart). Returns
   `listing_image_id`. Attach via the listing's `image_ids` array on
   update if you want a specific order.
3. **Upload video** (optional, max 1 per listing, ≤100MB, ≤60s).
4. **Update inventory** for variations + SKU + per-variant pricing — for
   vintage where each piece is unique, you can skip this and the
   listing-level price/quantity is used.
5. **Add translations** (optional, but valuable for an EU shop).
6. **Set state to `active`** to publish.

> **Auth gotcha.** Listing create/update uses `application/x-www-form-
> urlencoded` body, not JSON. The image/video upload endpoints use
> `multipart/form-data`. Only the inventory and translation endpoints
> take JSON. Our `etsy/client.ts` (Phase 4) hides this — but it's worth
> knowing why the wrapper exists.

---

## 2 · Authentication

Out of scope for this doc — see [developer-app.md](./developer-app.md)
and `src/lib/integrations/etsy/oauth.ts`. Short version:

- OAuth 2.0 with PKCE.
- Scopes for a publishing app:
  `listings_r listings_w transactions_r shops_r email_r`.
- Tokens stored in the `etsy_oauth` table, refreshed lazily by the
  client wrapper.
- Every API call carries `Authorization: Bearer <access_token>` and the
  `x-api-key: <client_id>` header.

---

## 3 · Core listing payload

The shape used by `createDraftListing` and `updateListing`. Update
accepts any subset of these fields; create requires the marked
properties.

```ts
// src/lib/integrations/etsy/types.ts  (preview — actual file lives in Phase 4)

/**
 * who_made:
 *   i_did         — handmade by the seller
 *   someone_else  — vintage / reseller / production partner
 *   collective    — handmade by a group
 *
 * For Retrospectiva (vintage reseller) this is always "someone_else".
 */
export type WhoMade = "i_did" | "someone_else" | "collective";

/**
 * when_made:
 *   Etsy requires "vintage" items to be 20+ years old. The decade values
 *   ("1990s" and earlier) are the eligible vintage windows. The
 *   year-range values ("2020_2025", etc.) are for handmade. "made_to_order"
 *   is for built-on-demand handmade.
 *
 * For Retrospectiva: pick the decade the garment is from
 * (most often 1970s–1990s). Anything 2006 or later cannot be a
 * "vintage" listing on Etsy.
 * 
 * This is gonna be useful when the AI, by looking our main image, decide which
 * decade inside the vintage etsy category use.
 */
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

export type ListingType = "physical" | "download" | "both";

export type ListingState =
  | "active"
  | "inactive"
  | "draft"
  | "expired"
  | "sold_out";

export type WeightUnit = "" | "oz" | "lb" | "g" | "kg";
export type DimensionUnit =
  | ""
  | "in"
  | "ft"
  | "mm"
  | "cm"
  | "m"
  | "yd"
  | "inches";

export type CreateDraftListingPayload = {
  // ───────────────── REQUIRED ─────────────────
  /** Total items available. Vintage = always 1 (each piece is unique). */
  quantity: number;
  /** ≤140 chars. SEO-critical — used in URL slug + search. */
  title: string;
  /** No length cap, but Etsy soft-caps display at ~120 lines. */
  description: string;
  /** Decimal in the shop's currency. We use EUR end-to-end. */
  price: number;
  who_made: WhoMade;
  when_made: WhenMade;
  /**
   * Etsy taxonomy id. Hierarchical: e.g. 67 = Vintage > Clothing > Women.
   * Fetch the tree via `GET /application/seller-taxonomy/nodes`.
   * Each taxonomy id has its own set of allowed property fields (size,
   * color, style) — see §8.
   */
  taxonomy_id: number;

  // ───────────────── SHIPPING ─────────────────
  /** Reusable shipping profile from /application/shops/{id}/shipping-profiles. */
  shipping_profile_id?: number;
  return_policy_id?: number;
  /** Min business days from order to ship. */
  processing_min?: number;
  /** Max business days from order to ship. */
  processing_max?: number;

  // ───────────────── MERCH ─────────────────
  /** ≤13 entries, each ≤45 chars. Fabric, fiber, leather type, etc. */
  materials?: string[];
  /** ≤13 entries, each ≤20 chars. SEO keywords. */
  tags?: string[];
  /** ≤2 entries. Etsy's predefined style enum (boho, minimalist, etc.). */
  styles?: string[];
  /** Internal grouping in your shop. */
  shop_section_id?: number;

  // ───────────────── PHYSICAL ATTRIBUTES ─────────────────
  // Shipping calculators use these. For vintage clothing, useful to
  // populate weight (saves the buyer being surprised by shipping).
  item_weight?: number;
  item_weight_unit?: WeightUnit;
  item_length?: number;
  item_width?: number;
  item_height?: number;
  item_dimensions_unit?: DimensionUnit;

  // ───────────────── PERSONALIZATION ─────────────────
  // Vintage items aren't usually personalizable — likely all defaults.
  is_personalizable?: boolean;
  personalization_is_required?: boolean;
  personalization_char_count_max?: number;
  personalization_instructions?: string;

  // ───────────────── PRODUCTION ─────────────────
  production_partner_ids?: number[];
  /** Image attach order. Use this on update to set rank. */
  image_ids?: number[];

  // ───────────────── CLASSIFICATION ─────────────────
  /** false for finished goods, true for supplies (yarn, fabric, beads). */
  is_supply?: boolean;
  /** Whether buyer can request customization. */
  is_customizable?: boolean;
  /** Default true. */
  is_taxable?: boolean;
  /** Default "physical". Digital files use "download" or "both". */
  type?: ListingType;
  /** Auto-renew the listing every 4 months (Etsy's default cycle). */
  should_auto_renew?: boolean;
};

/**
 * Update is a superset of create — any field can be omitted to leave
 * it unchanged, plus the listing's `state` can be transitioned.
 */
export type UpdateListingPayload = Partial<CreateDraftListingPayload> & {
  /** "draft" | "active" | "inactive" — Etsy doesn't allow direct →"sold_out". */
  state?: Exclude<ListingState, "expired" | "sold_out">;
  /** Featured rank within the shop section. */
  featured_rank?: number;
};
```

### Field-by-field notes for vintage clothing

| Field | What to set | Source in our admin |
| --- | --- | --- |
| `title` | ≤140 chars. AI-generated by Phase 6 with brand voice. | Auto from AI; admin can override. |
| `description` | Brand-voice description from AI; vintage-appropriate detail (era, condition, fabric). | Auto from AI; admin can override. |
| `price` | EUR price from our `products.priceCents`. | Already captured. |
| `quantity` | Always `1` for unique vintage. | Implicit. |
| `who_made` | Always `"someone_else"`. | Implicit. |
| `when_made` | Mapped from our era field (Phase 6 AI estimation). | `era` → `when_made`. |
| `taxonomy_id` | The Etsy node for the garment type (e.g. Vintage > Clothing > Women > Dresses). | Needs a category picker UI. |
| `materials` | Fabric / fiber blend (wool, cotton, silk, leather). | Likely AI + admin override. |
| `tags` | 13 search-keyword strings. AI generates a candidate set. | Auto from AI; admin can prune. |
| `styles` | Up to 2. Etsy enum (boho, gothic, art deco, …). | Admin picks (small enum). |
| `item_weight` + unit | Approx weight for shipping calc. Optional but UX win. | Admin enters (or estimates). |
| `item_*_unit` | "cm" for EU shop. | App default. |
| `shop_section_id` | Pre-existing collections in the Etsy shop (e.g. "70s dresses"). | Pulled from Etsy; admin picks. |
| `shipping_profile_id` | Reusable. The shop will have a small number. | Pulled from Etsy; admin picks. |
| `return_policy_id` | Reusable. | Pulled from Etsy; admin picks. |
| `is_supply` | Always `false`. | Implicit. |
| `is_personalizable` | Always `false`. | Implicit. |

---

## 4 · Image upload

Separate endpoint per image. Each call returns a `listing_image_id` which
becomes part of the listing's image list.

```ts
export type UploadListingImageInput = {
  /** Multipart file. JPEG / PNG / GIF. Max 10MB, max 3000×3000. */
  image: Blob;
  /** Display order, 1-indexed. 1 = primary photo (cover image). */
  rank?: number;
  /** Reuse an already-uploaded image by id. Mutually exclusive with `image`. */
  listing_image_id?: number;
  overwrite?: boolean;
  is_watermarked?: boolean;
  /** ≤250 chars. Accessibility + SEO. */
  alt_text?: string;
};

export type ListingImage = {
  listing_id: number;
  listing_image_id: number;
  hex_code: string | null;
  red: number;
  green: number;
  blue: number;
  hue: number;
  saturation: number;
  brightness: number;
  is_black_and_white: boolean;
  creation_tsz: number;
  rank: number;
  url_75x75: string;
  url_170x135: string;
  url_570xN: string;
  url_fullxfull: string;
  full_height: number;
  full_width: number;
  alt_text: string | null;
};
```

### Practical notes

- **Max 10 images per listing.** Etsy will reject the 11th.
- **Source format:** JPEG / PNG / GIF. **No WebP support on Etsy upload.**
  Decision locked in Phase 3: the client compresses to **JPEG** at upload
  time, so the bytes in R2 are already in a format Etsy accepts. No
  server-side transcode needed at publish.
- **`rank` = 1 is the cover image** that shows in search results. Maps
  to our `order=0` primary photo.
- **`alt_text`** is a real SEO + accessibility lever. We could derive
  from the AI description ("Front view of a 1970s Italian wool coat").

---

## 5 · Video upload

```ts
export type UploadListingVideoInput = {
  /** Multipart file. MP4 / MOV / WebM. Max 100MB, max 60s. */
  video: Blob;
  /** Display name in the Etsy listing UI. Not user-facing. */
  name?: string;
  /** Reuse by id, mutually exclusive with `video`. */
  video_id?: number;
};

export type ListingVideo = {
  listing_id: number;
  video_id: number;
  height: number;
  width: number;
  thumbnail_url: string;
  video_url: string;
  video_state: "active" | "inactive";
};
```

- **1 video per listing**, **≤100MB**, **≤60s** — these are the limits
  we already match in Phase 3's video uploader.
- Etsy auto-extracts a thumbnail; we don't need to send the poster we
  captured in the browser (though we keep it for the admin's own
  gallery).

---

## 6 · Inventory & variations

For unique vintage pieces, this is mostly **skip-able**: the
listing-level `price` and `quantity` cover the case. But the inventory
endpoint is what powers:

- Variations (size S/M/L, color red/blue) — relevant only if you ever
  list multiples of the same piece.
- SKUs.
- Per-variant pricing.

```ts
export type ListingPropertyValue = {
  property_id: number;
  property_name?: string;
  scale_id?: number;
  scale_name?: string;
  /** Pre-defined value ids from the property's `possible_values`. */
  value_ids?: number[];
  /** Custom free-text values (only allowed if the property permits). */
  values?: string[];
};

export type ListingOffering = {
  price: number;
  quantity: number;
  is_enabled: boolean;
};

export type InventoryProduct = {
  sku?: string;
  property_values?: ListingPropertyValue[];
  offerings: ListingOffering[];
};

export type UpdateInventoryPayload = {
  products: InventoryProduct[];
  price_on_property?: number[];
  quantity_on_property?: number[];
  sku_on_property?: number[];
};
```

For Retrospectiva: a single `products` entry with one `offerings` row,
no `property_values`, no `_on_property` arrays. The most useful
property to attach (even without variations) is the **size**, since
Etsy displays it on the buyer-facing listing.

---

## 7 · Translations

```ts
export type ListingTranslation = {
  language: string; // ISO 639-1, e.g. "es", "fr", "de"
  title: string;
  description: string;
  tags?: string[];
};
```

`PUT /application/shops/{shop_id}/listings/{listing_id}/translations/{language}`

For an EU shop, even one extra locale (Spanish or French) is a real
discovery win. The Phase 6 AI prompts can produce translations as a
follow-up step.

---

## 8 · Taxonomy & dynamic properties

This is where Etsy gets bureaucratic. Every category has its own set of
allowed properties, and those properties have their own value vocab.

### Getting the tree

```
GET /application/seller-taxonomy/nodes
```

Returns the full hierarchical category tree. For vintage clothing we
care about the subtree under "Vintage > Clothing".

### Getting properties for a category

```
GET /application/seller-taxonomy/nodes/{taxonomy_id}/properties
```

Returns the properties available for that node — e.g. for "Vintage >
Clothing > Women > Dresses":

| Property | Type | Required for ranking |
| --- | --- | --- |
| Size | scale + value | yes |
| Color (primary / secondary) | preset value or freeform | yes |
| Style | preset value | suggested |
| Occasion | preset value | optional |
| Sleeve length | preset value | optional |
| Neckline | preset value | optional |
| Pattern | preset value | optional |

```ts
export type TaxonomyProperty = {
  property_id: number;
  name: string;
  display_name: string;
  scales: Array<{
    scale_id: number;
    display_name: string;
    description: string;
  }>;
  is_required: boolean;
  supports_attributes: boolean;
  supports_variations: boolean;
  is_multivalued: boolean;
  max_values_allowed: number | null;
  possible_values: Array<{
    value_id: number;
    name: string;
    scale_id: number | null;
    equal_to: number[];
  }>;
  selected_values: number[];
};
```

For our admin: we don't want to hand-pick taxonomy ids. A better UX:

1. Admin picks a category from a dropdown of vintage-clothing leaves.
2. The form re-fetches that node's properties.
3. Form renders dynamic fields for each property (Size, Color, …).
4. On publish, those values go into the listing's `property_values` via
   the inventory endpoint.

That's a Phase 4 / Phase 9 stretch — for an MVP you might hardcode the
3-4 most-used taxonomy ids ("Vintage Women's Dresses", "Vintage
Outerwear", etc.).

---

## 9 · State machine

```
        ┌──────────────┐
        │    draft     │
        └──────┬───────┘
               │ updateListing({state: "active"})
               ▼
        ┌──────────────┐
        │    active    │ ───┐
        └──────┬───────┘    │ ↘
               │            │  buyer purchases
               │ admin      │  ────────────────►  sold_out (auto)
               │ archives   │                          │
               ▼            ▼                          │
        ┌──────────────┐                               │
        │   inactive   │ ◄─────────────────────────────┘
        └──────────────┘
        (also: expired ← auto when not renewed after 4 months)
```

What this means for our admin:

- **Our `published`** status maps to Etsy `active`.
- **Our `archived`** status (set by the sale webhook in Phase 7) maps
  to an Etsy listing that's in `sold_out` state — Etsy moves it
  automatically when the last unit ships.
- We don't manually set `sold_out` — Etsy does. We just observe the
  receipts via `getShopReceipts` (Phase 7).
- Manual archive (admin decided to pull a piece off Etsy without
  selling) → Etsy state `inactive`. We can drive this from the admin
  via an explicit "Unlist on Etsy" action.

---

## 10 · What this means for our product form

Reading the payload top-to-bottom, here's the field set worth surfacing
in the admin. Priorities reflect both "Etsy requires it" and "good SEO
on Etsy needs it":

### Already captured (Phase 2)

- `name` → `title`
- `priceCents` → `price`

### Should add next (drives Etsy publish, mostly AI-derivable)

| Form field | Maps to | Source |
| --- | --- | --- |
| Description | `description` | AI (Phase 6); admin override |
| Era | `when_made` | AI vision (Phase 6); admin override |
| Materials (tags) | `materials[]` | AI; admin can edit |
| Search tags | `tags[]` (≤13) | AI; admin can prune |
| Style | `styles[]` (≤2) | Admin picks from Etsy enum |
| Etsy category | `taxonomy_id` | Admin picks from a curated list |
| Size | property_value `Size` | Admin enters |
| Color (primary) | property_value `Color` | Admin enters (or AI vision) |

### Should add for SEO + UX wins

| Form field | Maps to | Why |
| --- | --- | --- |
| Alt text per photo | `alt_text` on image | Accessibility + Etsy SEO |
| Item weight + unit | `item_weight`, `item_weight_unit` | Shipping calculator UX |
| Item dimensions + unit | `item_*` + `item_dimensions_unit` | Shipping calculator UX |
| Condition note | (free-text in `description`) | Vintage-specific buyer expectation |
| Shop section | `shop_section_id` | "70s dresses" collection grouping |

### Configurable on the shop, not per-listing

These are typically shop-wide and can be presets in our admin:

- `shipping_profile_id` (one EU + one rest-of-world profile is common)
- `return_policy_id`
- `processing_min` / `processing_max`
- `is_taxable` (likely true everywhere)
- `should_auto_renew` (always true)

A "Settings > Etsy defaults" page can hold these once.

### Specialized / skip for vintage

- Personalization fields — always off.
- Production partners — N/A.
- Inventory variations — N/A (each piece is unique).
- `is_supply` — always false.
- Digital downloads — N/A.

### Translations (later)

Once the core EN listing flow works, a "translate to ES / FR" button
that calls the OpenAI text API and pushes via the translations endpoint
is a high-leverage QoL feature.

---

## 11 · Reference

- Etsy Open API v3 docs: <https://developer.etsy.com/documentation/reference/>
- OAuth 2.0 (PKCE) setup: <https://developer.etsy.com/documentation/essentials/authentication/>
- Listing fields:
  <https://developer.etsy.com/documentation/reference/#operation/createDraftListing>
- Taxonomy tree:
  <https://developer.etsy.com/documentation/reference/#operation/getSellerTaxonomyNodes>
- Image upload limits:
  <https://developer.etsy.com/documentation/reference/#operation/uploadListingImage>
- Video upload limits:
  <https://developer.etsy.com/documentation/reference/#operation/uploadListingVideo>
