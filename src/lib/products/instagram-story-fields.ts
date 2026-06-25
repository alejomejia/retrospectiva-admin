/**
 * The editable text model for the Instagram-story templates. Every text
 * slot in a template is a field here: the studio form renders one input
 * per field (pre-filled with the computed default) and the render route
 * reads back overrides. Kept free of React / satori / DB so the studio
 * (client) and the route (server) can both import it — same split as
 * `instagram-story-variants.ts`.
 *
 * The default copy below is ENGLISH on purpose: the generated story is an
 * English-only asset (see `instagram-story.ts`). UI labels for these
 * fields live in i18n (`socials.fields.*`), not here.
 */

import type { Product } from "@/lib/db/schema";

import {
  storyEyebrow,
  storyOriginalPriceLabel,
  storyPriceLabel,
} from "./instagram-story";
import type { StoryVariantKey } from "./instagram-story-variants";

/** Static default copy shared across templates (was inline / in i18n). */
const NEW_BADGE = "New today";
const SOLD_ACCENT = "Gone";
const FOOTER_TAGLINE = "One of a kind";

/** Cap on any single override (untrusted query param → satori). */
const MAX_FIELD_LENGTH = 200;

export type StoryFieldKey =
  | "badge"
  | "eyebrow"
  | "title"
  | "price"
  | "originalPrice"
  | "showDiscount"
  | "accent"
  | "footerTagline"
  | "country";

export type StoryFieldDef = {
  key: StoryFieldKey;
  /** Render a textarea rather than a single-line input. */
  multiline?: boolean;
  /** Empty value hides the element (vs. rendering an empty box). */
  nullable?: boolean;
  /**
   * Render a searchable country combobox (value is an ISO alpha-2 code)
   * rather than a free-text input. See `instagram-story-countries.ts`.
   */
  country?: boolean;
  /**
   * Render an on/off Switch. The value is `"1"` (on) or `""` (off); the
   * template reads it as a boolean gate, not display copy.
   */
  toggle?: boolean;
  /**
   * Hide this control from the form when the named field is empty — e.g. a
   * "show discount" toggle is pointless when there is no old price.
   */
  dependsOn?: StoryFieldKey;
};

/**
 * The ordered text slots per template — drives both the form order and the
 * set of override params the route trusts. Add a slot here and the studio
 * form + route pick it up automatically (add an i18n label too).
 */
export const STORY_FIELDS: Record<StoryVariantKey, readonly StoryFieldDef[]> = {
  new: [
    { key: "badge" },
    { key: "eyebrow", nullable: true },
    { key: "title", multiline: true },
    { key: "price", nullable: true },
    { key: "showDiscount", toggle: true, dependsOn: "originalPrice" },
    { key: "footerTagline" },
  ],
  sold: [
    { key: "accent" },
    { key: "title", multiline: true },
    { key: "footerTagline" },
    { key: "country", country: true, nullable: true },
  ],
};

/** Resolved copy for a template, keyed by field. */
export type StoryFields = Record<string, string>;

/** Published/sold products carry the English title; fall back defensively. */
function productTitle(product: Pick<Product, "titleEn" | "titleEs">): string {
  return product.titleEn?.trim() || product.titleEs?.trim() || "";
}

/**
 * The current values a template would render today, before any user edits —
 * derived from the product row. These pre-fill the studio form.
 *
 * @param variant - which template's field set to compute
 * @param product - the product row
 * @param shopMarkupPercent - shop-wide markup, for the price default
 */
export function defaultStoryFields(
  variant: StoryVariantKey,
  product: Product,
  shopMarkupPercent: number,
): StoryFields {
  const title = productTitle(product);

  if (variant === "sold") {
    return {
      accent: SOLD_ACCENT,
      title,
      footerTagline: FOOTER_TAGLINE,
      country: "",
    };
  }

  // The pre-discount price is computed, never user-edited (so it stays in
  // sync with the product) — kept out of STORY_FIELDS and recomputed each
  // render. The `showDiscount` toggle gates its strike-through; on by
  // default whenever a sale is active.
  const originalPrice = storyOriginalPriceLabel(product, shopMarkupPercent);

  return {
    badge: NEW_BADGE,
    eyebrow: storyEyebrow(product) ?? "",
    title,
    price: storyPriceLabel(product, shopMarkupPercent) ?? "",
    originalPrice: originalPrice ?? "",
    showDiscount: originalPrice ? "1" : "",
    footerTagline: FOOTER_TAGLINE,
  };
}

/**
 * Reads the per-field overrides from untrusted query params: only known
 * keys for the variant, each clamped to `MAX_FIELD_LENGTH`. An absent param
 * is omitted (so the default wins); a present-but-empty one maps to `""`
 * (so a nullable slot is intentionally hidden).
 *
 * @param params - the request's search params
 * @param variant - which template's field set to read
 */
export function parseFieldOverrides(
  params: URLSearchParams,
  variant: StoryVariantKey,
): StoryFields {
  const out: StoryFields = {};
  for (const def of STORY_FIELDS[variant]) {
    const raw = params.get(def.key);
    if (raw === null) continue;
    out[def.key] = raw.slice(0, MAX_FIELD_LENGTH);
  }
  return out;
}

/**
 * The final copy a template renders: product-derived defaults with the
 * request's overrides laid on top.
 *
 * @param variant - which template to resolve
 * @param product - the product row
 * @param shopMarkupPercent - shop-wide markup, for the price default
 * @param params - the request's search params (override source)
 */
export function resolveStoryFields(
  variant: StoryVariantKey,
  product: Product,
  shopMarkupPercent: number,
  params: URLSearchParams,
): StoryFields {
  return {
    ...defaultStoryFields(variant, product, shopMarkupPercent),
    ...parseFieldOverrides(params, variant),
  };
}
