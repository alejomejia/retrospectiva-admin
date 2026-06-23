"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { m } from "@/lib/i18n/messages.es";
import { devError } from "@/lib/utils/dev";
import {
  STORY_FIELDS,
  type StoryFields,
} from "@/lib/products/instagram-story-fields";
import type { StoryVariantKey } from "@/lib/products/instagram-story-variants";

import type { InstagramStudioProps } from "./instagram-studio.types";

/** Builds the render-route URL for a variant + product + photo + edited copy. */
function buildStoryUrl(
  productId: string,
  variant: StoryVariantKey,
  imageId: string | null,
  fields: StoryFields,
  transparent: boolean,
): string {
  const params = new URLSearchParams();
  params.set("variant", variant);
  params.set("productId", productId);
  if (imageId) params.set("imageId", imageId);
  if (transparent) params.set("transparent", "1");
  // Every field is sent (including cleared ones, which the route reads as
  // an intentional "hide" for nullable slots).
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }
  return `/socials/instagram-story?${params.toString()}`;
}

/**
 * Builds the video-render URL: same copy as the still, composited over the
 * chosen product video. The route forces the chrome transparent (the video is
 * the background), so no `imageId`/`transparent` here.
 */
function buildStoryVideoUrl(
  productId: string,
  variant: StoryVariantKey,
  videoId: string | null,
  fields: StoryFields,
): string {
  const params = new URLSearchParams();
  params.set("variant", variant);
  params.set("productId", productId);
  if (videoId) params.set("videoId", videoId);
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, value);
  }
  return `/socials/instagram-story/video?${params.toString()}`;
}

/**
 * State + actions for the Instagram studio: the background photo, the
 * editable copy, the preview URL they map to, and the fetch→blob→anchor
 * download.
 *
 * The preview regenerates only on *commit* points — choosing a photo, or a
 * text field losing focus (blur) — never per keystroke. The satori render is
 * CPU-bound, so this keeps it to one render per finished edit (no debounce
 * or throttle needed). Downloads always use the freshest copy, so a download
 * right after typing (without blurring) still carries the edit.
 */
export function useInstagramStudio({
  productId,
  variant,
  images,
  videos,
  defaultFields,
}: InstagramStudioProps) {
  const featuredId = images[0]?.id ?? null;
  const featuredVideoId = videos[0]?.id ?? null;
  const fieldDefs = STORY_FIELDS[variant];

  const [selectedId, setSelectedId] = useState<string | null>(featuredId);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    featuredVideoId,
  );
  const [fields, setFields] = useState<StoryFields>(() => ({
    ...defaultFields,
  }));
  // Background photo on by default; toggling off emits a transparent PNG.
  const [transparent, setTransparent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(() =>
    buildStoryUrl(productId, variant, featuredId, defaultFields, false),
  );

  // Repoint the preview at the current selections. Called at commit points
  // only (photo pick, field blur, reset, transparency toggle) — not on every
  // keystroke.
  const commitPreview = useCallback(
    (imageId: string | null, nextFields: StoryFields, isTransparent: boolean) => {
      setPreviewUrl(
        buildStoryUrl(productId, variant, imageId, nextFields, isTransparent),
      );
    },
    [productId, variant],
  );

  function selectImage(id: string) {
    setSelectedId(id);
    commitPreview(id, fields, transparent);
  }

  function toggleTransparent(next: boolean) {
    setTransparent(next);
    commitPreview(selectedId, fields, next);
  }

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // Sets a field and commits the preview in one step, with the new value —
  // for controls that change and commit in the same tick (e.g. the country
  // combobox), where `commitFields` would otherwise read a stale `fields`.
  function commitField(key: string, value: string) {
    const next = { ...fields, [key]: value };
    setFields(next);
    commitPreview(selectedId, next, transparent);
  }

  // Field inputs call this on blur; `fields` is already up to date from the
  // onChange that preceded losing focus.
  function commitFields() {
    commitPreview(selectedId, fields, transparent);
  }

  function resetFields() {
    const next = { ...defaultFields };
    setFields(next);
    commitPreview(selectedId, next, transparent);
  }

  async function download() {
    // Build from current state, not the (possibly older) preview URL, so a
    // download right after an un-blurred edit still carries it.
    const targetUrl = buildStoryUrl(
      productId,
      variant,
      selectedId,
      fields,
      transparent,
    );
    setIsDownloading(true);
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `retrospectiva-${variant}-${productId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(m.socials.studio.downloadedToast);
    } catch {
      toast.error(m.socials.studio.errorToast);
    } finally {
      setIsDownloading(false);
    }
  }

  // Composites the chrome over the selected product video (server-side ffmpeg)
  // and downloads the mp4. Slow relative to the still — the button shows a
  // pending state for the whole encode.
  async function downloadVideo() {
    if (!selectedVideoId) return;
    const targetUrl = buildStoryVideoUrl(
      productId,
      variant,
      selectedVideoId,
      fields,
    );
    setIsDownloadingVideo(true);
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        // The route returns the underlying error text in the body — log the
        // full thing to the browser console (greppable, copy-pasteable) and
        // show a trimmed version in the toast.
        const detail = await res.text().catch(() => "");
        devError("video generation failed", {
          status: res.status,
          url: targetUrl,
          detail,
        });
        throw new Error(detail || `status ${res.status}`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `retrospectiva-${variant}-${productId}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      toast.success(m.socials.studio.downloadedToast);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      devError("video download error", err);
      toast.error(m.socials.studio.videoErrorToast, {
        description: detail.slice(0, 300),
      });
    } finally {
      setIsDownloadingVideo(false);
    }
  }

  return {
    selectedId,
    selectImage,
    fields,
    fieldDefs,
    setField,
    commitField,
    commitFields,
    resetFields,
    transparent,
    toggleTransparent,
    previewUrl,
    isDownloading,
    download,
    hasVideos: videos.length > 0,
    videos,
    selectedVideoId,
    selectVideo: setSelectedVideoId,
    isDownloadingVideo,
    downloadVideo,
  };
}
