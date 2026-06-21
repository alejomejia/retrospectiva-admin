import type { ReactElement } from "react";

import type { StoryFields } from "@/lib/products/instagram-story-fields";

/**
 * Everything a template needs to render, resolved once by the route: the
 * editable copy (defaults + user overrides, see `instagram-story-fields.ts`)
 * and the image assets. Templates read their text from `fields.*` — they no
 * longer derive copy from the product row.
 */
export type StoryRenderContext = {
  /** Resolved template copy, keyed by field. */
  fields: StoryFields;
  /** Public URL of the chosen product photo. */
  photoUrl: string;
  /** Brand logo as a data URI (transparent SVG). */
  logoUrl: string;
  /** SOLD stamp seal as a data URI (transparent PNG) — used by `sold`. */
  sealUrl: string;
};

/** A template: pure function from context to satori JSX. */
export type StoryRenderer = (ctx: StoryRenderContext) => ReactElement;
