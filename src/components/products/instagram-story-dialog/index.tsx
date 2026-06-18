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

import { InstagramStoryImagePicker } from "./instagram-story-dialog-image-picker";
import { InstagramStoryPreview } from "./instagram-story-dialog-preview";
import { useInstagramStory } from "./use-instagram-story";

/**
 * Button + dialog to generate and download a 1080×1920 Instagram-story
 * image from one of the product's photos. Disabled until the product is
 * published (only then does the English title/copy the design needs
 * exist); a tooltip explains the disabled state.
 */
export function InstagramStoryDialog({
  productId,
  images,
  disabled = false,
}: {
  productId: string;
  images: ImageListItem[];
  /** True until the product is published (no English copy to render). */
  disabled?: boolean;
}) {
  const story = useInstagramStory({ productId, images });
  const hasImages = images.length > 0;
  const isDisabled = disabled || !hasImages;

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

          <div className="flex flex-col gap-2">
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
