import type { ImageListItem } from "@/components/products/image-list";
import type { StoryFields } from "@/lib/products/instagram-story-fields";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

/** Props for the Instagram studio (server page → client component). */
export type InstagramStudioProps = {
  productId: string;
  /** The single template this page generates (chosen on the landing). */
  variant: StoryVariantKey;
  /** All product photos; first is the default background. */
  images: ImageListItem[];
  /**
   * Computed default copy for the variant — pre-fills the field inputs and
   * seeds "reset to defaults".
   */
  defaultFields: StoryFields;
};
