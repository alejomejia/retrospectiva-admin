import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

import { renderNewStory } from "./new-story";
import type { StoryRenderer } from "./types";

/**
 * Server-side render map: variant key → satori renderer. Add a new
 * template here (and its key/statuses in `../variants.ts`). The
 * `Record<StoryVariantKey, …>` makes a missing renderer a type error.
 */
export const STORY_RENDERERS: Record<StoryVariantKey, StoryRenderer> = {
  new: renderNewStory,
};

export type { StoryRenderContext, StoryRenderer } from "./types";
