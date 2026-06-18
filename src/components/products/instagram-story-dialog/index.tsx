"use client";

import { Download, ImageDown } from "lucide-react";

import type { ImageListItem } from "@/components/products/image-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { m } from "@/lib/i18n/messages.es";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

import { InstagramStoryImagePicker } from "./instagram-story-dialog-image-picker";
import { InstagramStoryPreview } from "./instagram-story-dialog-preview";
import { InstagramStoryVariantPicker } from "./instagram-story-dialog-variant-picker";
import { useInstagramStory } from "./use-instagram-story";

/**
 * Button + dialog to generate and download a 1080×1920 Instagram-story
 * image. The user picks a template (when more than one applies to the
 * product) and a background photo, previews, and downloads. Disabled
 * when no template applies to the product's current status; a tooltip
 * explains why.
 */
export function InstagramStoryDialog({
  productId,
  images,
  variants,
}: {
  productId: string;
  images: ImageListItem[];
  /** Templates available for this product (by status). Empty = disabled. */
  variants: readonly StoryVariantKey[];
}) {
  const story = useInstagramStory({ productId, images, variants });
  const hasImages = images.length > 0;
  const isDisabled = variants.length === 0 || !hasImages;

  const triggerButton = (
    <Button type="button" variant="outline" disabled={isDisabled}>
      <ImageDown className="size-4" />
      {m.products.instagramStory.buttonLabel}
    </Button>
  );

  // A disabled button doesn't emit pointer events, so the tooltip is
  // attached to a wrapping span (and the dialog isn't mounted at all).
  if (isDisabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{triggerButton}</span>
        </TooltipTrigger>
        <TooltipContent>
          {m.products.instagramStory.disabledTooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={story.open} onOpenChange={story.setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{m.products.instagramStory.dialogTitle}</DialogTitle>
          <DialogDescription>
            {m.products.instagramStory.dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {variants.length > 1 ? (
          <div className="flex flex-col gap-2">
            <span className="text-caplet text-muted-foreground">
              {m.products.instagramStory.selectVariantLabel}
            </span>
            <InstagramStoryVariantPicker
              variants={variants}
              selected={story.selectedVariant}
              onSelect={story.setSelectedVariant}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-caplet text-muted-foreground">
              {m.products.instagramStory.selectImageLabel}
            </span>
            <InstagramStoryImagePicker
              images={images}
              selectedId={story.selectedId}
              onSelect={story.setSelectedId}
            />
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <span className="text-caplet text-muted-foreground">
              {m.products.instagramStory.previewLabel}
            </span>
            {story.previewUrl ? (
              <InstagramStoryPreview
                key={story.previewUrl}
                previewUrl={story.previewUrl}
              />
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          onClick={story.download}
          disabled={story.isDownloading || !story.previewUrl}
        >
          <Download className="size-4" />
          {m.products.instagramStory.downloadLabel}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
