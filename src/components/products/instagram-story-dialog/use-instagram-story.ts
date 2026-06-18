"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ImageListItem } from "@/components/products/image-list";
import { m } from "@/lib/i18n/messages.es";

type UseInstagramStoryArgs = {
  productId: string;
  images: ImageListItem[];
};

/**
 * State + actions for the Instagram-story dialog: which photo is the
 * background, the preview/download URL it maps to, and the
 * fetch→blob→anchor download. The featured photo (first in the ordered
 * list) is the default; the selection resets to it each time the dialog
 * opens so a stale pick never carries over.
 */
export function useInstagramStory({
  productId,
  images,
}: UseInstagramStoryArgs) {
  const featuredId = images[0]?.id ?? null;
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(featuredId);
  const [isDownloading, setIsDownloading] = useState(false);

  // Reset the pick to the featured photo each time the dialog opens, in
  // the event handler (not an effect) so a stale selection never lingers.
  function handleOpenChange(next: boolean) {
    if (next) setSelectedId(featuredId);
    setOpen(next);
  }

  const previewUrl = useMemo(
    () =>
      selectedId
        ? `/products/${productId}/instagram-story?imageId=${selectedId}`
        : null,
    [productId, selectedId],
  );

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
      a.download = `retrospectiva-${productId}.png`;
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
    previewUrl,
    isDownloading,
    download,
  };
}
