"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ImageListItem } from "@/components/products/image-list";
import { m } from "@/lib/i18n/messages.es";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

type UseInstagramStoryArgs = {
  productId: string;
  images: ImageListItem[];
  /** Templates available for this product (by status). First is default. */
  variants: readonly StoryVariantKey[];
};

/**
 * State + actions for the Instagram-story dialog: the chosen template
 * variant, the background photo, the preview/download URL they map to,
 * and the fetch→blob→anchor download. Selections reset to their defaults
 * (first variant, featured photo) each time the dialog opens so a stale
 * pick never carries over.
 */
export function useInstagramStory({
  productId,
  images,
  variants,
}: UseInstagramStoryArgs) {
  const featuredId = images[0]?.id ?? null;
  const defaultVariant = variants[0] ?? null;

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(featuredId);
  const [selectedVariant, setSelectedVariant] =
    useState<StoryVariantKey | null>(defaultVariant);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset picks each time the dialog opens, in the event handler (not an
  // effect) so a stale selection never lingers.
  function handleOpenChange(next: boolean) {
    if (next) {
      setSelectedId(featuredId);
      setSelectedVariant(defaultVariant);
    }
    setOpen(next);
  }

  const previewUrl = useMemo(() => {
    if (!selectedId || !selectedVariant) return null;
    const query = new URLSearchParams({
      variant: selectedVariant,
      imageId: selectedId,
    });
    return `/products/${productId}/instagram-story?${query.toString()}`;
  }, [productId, selectedId, selectedVariant]);

  async function download() {
    if (!previewUrl) return;
    setIsDownloading(true);
    try {
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `retrospectiva-${selectedVariant}-${productId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(m.products.instagramStory.downloadedToast);
    } catch {
      toast.error(m.products.instagramStory.errorToast);
    } finally {
      setIsDownloading(false);
    }
  }

  return {
    open,
    setOpen: handleOpenChange,
    selectedId,
    setSelectedId,
    selectedVariant,
    setSelectedVariant,
    previewUrl,
    isDownloading,
    download,
  };
}
