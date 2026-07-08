"use client";

import { Download, Film, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { m } from "@/lib/i18n/messages.en";
import { cn } from "@/lib/utils/helpers";

import { InstagramStudioFieldsForm } from "./instagram-studio-fields-form";
import { InstagramStudioImagePicker } from "./instagram-studio-image-picker";
import { InstagramStudioPreview } from "./instagram-studio-preview";
import type { InstagramStudioProps } from "./instagram-studio.types";
import { useInstagramStudio } from "./use-instagram-studio";

/**
 * The social-asset generator for a single product + template: pick a
 * background photo, edit every text slot (pre-filled with the values we
 * compute from the product), preview the 1080×1920 render, and download the
 * PNG. The preview regenerates on commit points (photo pick, field blur),
 * not per keystroke. Compound surface (`InstagramStudio.Preview`, etc.) so
 * future layouts can recompose the parts.
 */
function InstagramStudioRoot(props: InstagramStudioProps) {
  const studio = useInstagramStudio(props);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="flex flex-col gap-6 py-6">
        <section className="flex flex-col gap-3">
          <span className="text-caplet text-muted-foreground">
            {m.socials.studio.selectImageLabel}
          </span>
          <InstagramStudioImagePicker
            images={props.images}
            selectedId={studio.selectedId}
            onSelect={studio.selectImage}
          />
          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="story-transparent">
                {m.socials.studio.transparentLabel}
              </Label>
              <span className="text-caplet text-muted-foreground">
                {m.socials.studio.transparentHint}
              </span>
            </div>
            <Switch
              id="story-transparent"
              checked={studio.transparent}
              onCheckedChange={studio.toggleTransparent}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-caplet text-muted-foreground">
              {m.socials.studio.fieldsLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={studio.resetFields}
            >
              <RotateCcw className="size-3.5" />
              {m.socials.studio.resetLabel}
            </Button>
          </div>
          <InstagramStudioFieldsForm
            fieldDefs={studio.fieldDefs}
            fields={studio.fields}
            onChange={studio.setField}
            onCommit={studio.commitFields}
            onCommitField={studio.commitField}
          />
        </section>
      </div>

      <div className="sticky top-0 self-start flex flex-col gap-3 py-6">
        <span className="text-caplet text-muted-foreground">
          {m.socials.studio.previewLabel}
        </span>
        <InstagramStudioPreview
          key={studio.previewUrl}
          previewUrl={studio.previewUrl}
        />
        <Button
          type="button"
          onClick={studio.download}
          disabled={studio.isDownloading}
        >
          <Download className="size-4" />
          {m.socials.studio.downloadLabel}
        </Button>

        {studio.hasVideos ? (
          <>
            {studio.videos.length > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-caplet text-muted-foreground">
                  {m.socials.studio.selectVideoLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {studio.videos.map((video, i) => (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => studio.selectVideo(video.id)}
                      className={cn(
                        "relative size-14 overflow-hidden rounded-md border bg-muted",
                        studio.selectedVideoId === video.id
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border",
                      )}
                    >
                      {video.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`${i + 1}`}
                          src={video.posterUrl}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Film className="absolute inset-0 m-auto size-5 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              onClick={studio.downloadVideo}
              disabled={studio.isDownloadingVideo}
            >
              {studio.isDownloadingVideo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Film className="size-4" />
              )}
              {studio.isDownloadingVideo
                ? m.socials.studio.downloadVideoPending
                : m.socials.studio.downloadVideoLabel}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export const InstagramStudio = Object.assign(InstagramStudioRoot, {
  ImagePicker: InstagramStudioImagePicker,
  FieldsForm: InstagramStudioFieldsForm,
  Preview: InstagramStudioPreview,
});

export type * from "./instagram-studio.types";
