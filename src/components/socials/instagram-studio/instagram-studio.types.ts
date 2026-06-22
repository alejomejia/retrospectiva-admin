import type { ImageListItem } from "@/components/products/image-list";
import type { StoryFields } from "@/lib/products/instagram-story-fields";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

/** A product video selectable as the story's moving background. */
export type StudioVideoItem = {
  id: string;
  /** Poster frame for the picker thumbnail, if the browser captured one. */
  posterUrl: string | null;
};

/** Props for the Instagram studio (server page → client component). */
export type InstagramStudioProps = {
  productId: string;
  /** The single template this page generates (chosen on the landing). */
  variant: StoryVariantKey;
  /** All product photos; first is the default background. */
  images: ImageListItem[];
  /**
   * Product videos available as a moving background, first is the default.
   * Empty when the product has none — the video download is hidden then.
   */
  videos: StudioVideoItem[];
  /**
   * Computed default copy for the variant — pre-fills the field inputs and
   * seeds "reset to defaults".
   */
  defaultFields: StoryFields;
};
