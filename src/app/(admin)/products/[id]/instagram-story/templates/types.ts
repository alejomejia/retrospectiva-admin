import type { ReactElement } from "react";

import type { Product } from "@/lib/db/schema";

/**
 * Everything a template needs to render, resolved once by the route:
 * the product row, the chosen photo URL, the embedded logo, and the
 * shop markup (for price math). Templates derive their own copy from
 * `product` (title, eyebrow, price, …).
 */
export type StoryRenderContext = {
  product: Product;
  /** Public URL of the chosen product photo. */
  photoUrl: string;
  /** Brand logo as a data URI (transparent SVG). */
  logoUrl: string;
  /** SOLD stamp seal as a data URI (transparent PNG) — used by `sold`. */
  sealUrl: string;
  /** Shop-wide markup percent, for price computation. */
  shopMarkupPercent: number;
};

/** A template: pure function from context to satori JSX. */
export type StoryRenderer = (ctx: StoryRenderContext) => ReactElement;
