"use client";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

/**
 * Segmented toggle for the story template. The caller only renders this
 * when more than one variant is available for the product.
 */
export function InstagramStoryVariantPicker({
  variants,
  selected,
  onSelect,
}: {
  variants: readonly StoryVariantKey[];
  selected: StoryVariantKey | null;
  onSelect: (key: StoryVariantKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {variants.map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={key === selected ? "default" : "outline"}
          onClick={() => onSelect(key)}
          aria-pressed={key === selected}
        >
          {m.products.instagramStory.variants[key]}
        </Button>
      ))}
    </div>
  );
}
