import {
  DEFAULT_MARKUP_PERCENT,
  effectiveListCents,
  inflatedListCents,
} from "@/lib/products/pricing";
import type { Product } from "@/lib/db/schema";

import { appendListingFooter } from "@/lib/products/listing-footer";

import { isEtsyColor } from "./etsy-colors";

import type {
  CreateDraftListingPayload,
  WhenMade,
} from "./listings";

/**
 * Etsy `when_made` accepts a fixed enum. The `etsy_when_made` column
 * is a free-text field (the AI fills it from the registry) — we
 * validate at the mapper boundary so an out-of-vocab value fails the
 * publish loudly instead of silently corrupting the listing.
 */
const WHEN_MADE_VALUES: ReadonlySet<WhenMade> = new Set<WhenMade>([
  "made_to_order",
  "2020_2025",
  "2010_2019",
  "2006_2009",
  "before_2006",
  "2000_2005",
  "1990s",
  "1980s",
  "1970s",
  "1960s",
  "1950s",
  "1940s",
  "1930s",
  "1920s",
  "1910s",
  "1900s",
  "1800s",
  "1700s",
  "before_1700",
]);

/** Etsy enforces these caps; we trim defensively so the publish
 *  never fails a length validation server-side. The product form
 *  already enforces equivalent limits on the way in. */
const MAX_TAGS = 13;
const MAX_TAG_LEN = 20;
const MAX_MATERIALS = 13;
const MAX_MATERIAL_LEN = 45;
const MAX_TITLE_LEN = 140;

export type ShopPublishConfig = {
  shopId: number;
  returnPolicyId: number | null;
  readinessStateId: number | null;
  markupPercent: number;
};

export type MapToCreateDraftInput = {
  product: Product;
  shop: ShopPublishConfig;
  /**
   * Resolved EN listing footer (care/legal boilerplate) appended to
   * the description. Empty string appends nothing. Defaults to "" so
   * existing callers/tests that don't pass a footer are unaffected.
   */
  footerEn?: string;
};

export class ListingMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingMapperError";
  }
}

/**
 * Builds the `createDraftListing` payload from a product row plus
 * shop-level defaults. EN fields are read from the cached `*_en`
 * columns (the publish processor populates them inline via
 * `runTranslation` before calling this mapper).
 *
 * Throws `ListingMapperError` with a precise, user-actionable
 * message when a required field is missing — the publish processor
 * surfaces these as the job failure reason, and the operator gets a
 * concrete fix (e.g. "missing taxonomy_id" → pick a clothing type).
 */
export function mapProductToCreateDraftPayload({
  product,
  shop,
  footerEn = "",
}: MapToCreateDraftInput): CreateDraftListingPayload {
  const title = (product.titleEn ?? "").trim();
  if (!title) throw new ListingMapperError("missing titleEn");
  if (title.length > MAX_TITLE_LEN) {
    throw new ListingMapperError(
      `titleEn exceeds ${MAX_TITLE_LEN} chars (got ${title.length})`,
    );
  }

  const descriptionBody = (product.descriptionEn ?? "").trim();
  if (!descriptionBody) throw new ListingMapperError("missing descriptionEn");
  // Footer appended at the payload boundary only — never stored in the
  // description column (keeps it out of the AI + translation paths).
  const description = appendListingFooter(descriptionBody, footerEn);

  if (!product.etsyTaxonomyId) {
    throw new ListingMapperError("missing etsyTaxonomyId");
  }

  if (!product.etsyWhenMade) {
    throw new ListingMapperError("missing etsyWhenMade");
  }
  if (!WHEN_MADE_VALUES.has(product.etsyWhenMade as WhenMade)) {
    throw new ListingMapperError(
      `etsyWhenMade "${product.etsyWhenMade}" is not a valid Etsy when_made value`,
    );
  }

  const listCents = effectiveListCents({
    basePriceCents: product.basePriceCents,
    markupPercentOverride: product.markupPercentOverride,
    listPriceCentsOverride: product.listPriceCentsOverride,
    shopMarkupPercent: shop.markupPercent ?? DEFAULT_MARKUP_PERCENT,
  });
  if (listCents === null) {
    throw new ListingMapperError("missing basePriceCents");
  }
  // Charm-price the value at the Etsy boundary so every published
  // listing ends in `.99`. When the product carries a discount the
  // price is also inflated so a matching `%` sale (run in Shop Manager)
  // lands the buyer near `listCents`. The canonical `basePriceCents`
  // stays exact upstream — only the listing payload sees the bump.
  const price = +(
    inflatedListCents(listCents, product.discountPercent) / 100
  ).toFixed(2);

  const tags = sanitizeStringList(
    product.etsyTagsEn ?? [],
    MAX_TAGS,
    MAX_TAG_LEN,
  );
  const materials = sanitizeStringList(
    product.etsyMaterialsEn ?? [],
    MAX_MATERIALS,
    MAX_MATERIAL_LEN,
  );

  const payload: CreateDraftListingPayload = {
    quantity: 1,
    title,
    description,
    price,
    who_made: "someone_else",
    when_made: product.etsyWhenMade as WhenMade,
    taxonomy_id: product.etsyTaxonomyId,
    type: "physical",
    is_supply: false,
    is_personalizable: false,
    is_taxable: true,
    should_auto_renew: true,
  };
  if (product.shippingProfileId !== null) {
    payload.shipping_profile_id = product.shippingProfileId;
  }
  if (shop.returnPolicyId !== null) {
    payload.return_policy_id = shop.returnPolicyId;
  }
  if (shop.readinessStateId === null) {
    // Etsy v3 requires `readiness_state_id` on physical listings.
    // Fail at the mapper boundary with a precise reason so the
    // operator gets pointed at /settings/integrations instead of a
    // 400 from Etsy.
    throw new ListingMapperError("missing readinessStateId");
  }
  payload.readiness_state_id = shop.readinessStateId;
  if (tags.length > 0) payload.tags = tags;
  if (materials.length > 0) payload.materials = materials;

  if (isEtsyColor(product.etsyPrimaryColor)) {
    payload.primary_color = product.etsyPrimaryColor;
  }
  if (isEtsyColor(product.etsySecondaryColor)) {
    payload.secondary_color = product.etsySecondaryColor;
  }
  if (product.isFeatured) {
    // Etsy treats any positive `featured_rank` as "featured"; the
    // exact value only controls the display order among featured
    // listings (max 4 shop-wide).
    payload.featured_rank = 1;
  }

  return payload;
}

function sanitizeStringList(
  list: string[],
  maxItems: number,
  maxLen: number,
): string[] {
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > maxLen) continue;
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}
