"use client";

import { Check } from "lucide-react";
import Image from "next/image";

import type { ImageListItem } from "@/components/products/image-list";
import { cn } from "@/lib/utils/helpers";

/**
 * Single-select thumbnail grid for choosing the story background photo.
 * The currently selected tile gets a ring + check badge.
 */
export function InstagramStoryImagePicker({
  images,
  selectedId,
  onSelect,
}: {
  images: ImageListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {images.map((image) => {
        const isSelected = image.id === selectedId;
        return (
          <li key={image.id}>
            <button
              type="button"
              onClick={() => onSelect(image.id)}
              aria-pressed={isSelected}
              className={cn(
                "relative block w-full overflow-hidden rounded-md border-2 bg-brand-paper transition-colors",
                isSelected
                  ? "border-brand-terracotta"
                  : "border-transparent hover:border-border",
              )}
              style={{ aspectRatio: 9 / 16 }}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
              {isSelected ? (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream">
                  <Check className="size-3" />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
