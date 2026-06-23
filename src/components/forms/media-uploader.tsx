"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import { uploadProductImage } from "@/lib/products/images-actions";
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_MAX_MB,
} from "@/lib/products/media-limits";
import { uploadProductVideo } from "@/lib/products/videos-actions";
import { compressImage } from "@/lib/utils/compress-image";
import { extractVideoPoster } from "@/lib/utils/extract-video-poster";
import { cn } from "@/lib/utils/helpers";

const ACCEPT = [
  // images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
  // videos
  "video/mp4",
  "video/quicktime",
  "video/webm",
  ".mp4",
  ".mov",
  ".webm",
].join(",");

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
}

function isVideo(file: File): boolean {
  return (
    file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)
  );
}

/**
 * Single drop-target for both photos and videos. Each dropped file is
 * dispatched per its MIME type:
 *
 *   - images → browser-side JPEG compression + EXIF strip + lazy HEIC
 *     decode, then `uploadProductImage`
 *   - videos → auto-trim to fit the size cap if oversize (ffmpeg.wasm,
 *     tail cut), browser-side poster extraction (Canvas @ 1s), then
 *     `uploadProductVideo`
 *
 * The two pipelines stay distinct internally (different size budgets,
 * different processing), but the user sees one dropzone. Toast at the
 * end summarizes both counts in a single message.
 */
export function MediaUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      setBusy(true);
      let imagesOk = 0;
      let videosOk = 0;
      try {
        for (const raw of list) {
          try {
            if (isImage(raw)) {
              const { file, width, height } = await compressImage(raw);
              const result = await uploadProductImage({
                productId,
                file,
                width,
                height,
              });
              if (!result.ok) {
                toast.error(`${raw.name}: ${result.error}`);
                continue;
              }
              imagesOk += 1;
            } else if (isVideo(raw)) {
              // Client-side preprocessing runs BEFORE uploading anything
              // (in-browser, ffmpeg.wasm) so nothing wasteful hits the
              // wire. Every video has its audio stripped — product clips
              // never need sound — and an oversize clip then has its tail
              // trimmed until it fits the cap (the oversize bytes never
              // leave the browser). On failure we fall back: reject if the
              // original is over the cap, otherwise upload it untouched.
              let video = raw;
              toast.info(`${raw.name}: ${m.toasts.videoProcessing}`);
              try {
                const { prepareVideoForUpload } = await import(
                  "@/lib/utils/trim-video"
                );
                const processed = await prepareVideoForUpload(video);
                video = processed.file;
                if (processed.trimmed) {
                  toast.success(
                    `${raw.name}: ${m.toasts.videoTrimmed(
                      processed.originalSeconds.toFixed(1),
                      processed.keptSeconds.toFixed(1),
                    )}`,
                  );
                }
              } catch {
                if (raw.size > VIDEO_MAX_BYTES) {
                  toast.error(
                    `${raw.name}: ${m.errors.videoTrimFailed(
                      (raw.size / 1024 / 1024).toFixed(1),
                      VIDEO_MAX_MB,
                    )}`,
                  );
                  continue;
                }
                // Under the cap but preprocessing failed (e.g. unreadable
                // duration): upload the original as-is, audio included.
                video = raw;
              }
              const { poster, durationMs, width, height } =
                await extractVideoPoster(video);
              if (
                durationMs !== null &&
                durationMs > VIDEO_MAX_DURATION_MS
              ) {
                toast.error(
                  `${raw.name}: ${m.errors.videoTooLong(
                    (durationMs / 1000).toFixed(1),
                    VIDEO_MAX_DURATION_SECONDS,
                  )}`,
                );
                continue;
              }
              const result = await uploadProductVideo({
                productId,
                video,
                poster,
                durationMs,
                width,
                height,
              });
              if (!result.ok) {
                toast.error(`${raw.name}: ${result.error}`);
                continue;
              }
              videosOk += 1;
            } else {
              toast.error(m.uploader.media.unsupportedType(raw.name));
            }
          } catch (err) {
            toast.error(
              `${raw.name}: ${err instanceof Error ? err.message : m.errors.uploadFailed}`,
            );
          }
        }
        if (imagesOk > 0 || videosOk > 0) {
          toast.success(m.toasts.mediaUploaded(imagesOk, videosOk));
          // Server actions call `revalidatePath` but the currently
          // mounted page doesn't always re-fetch its server props
          // without an explicit refresh — so the new ImageList /
          // VideoList items wouldn't appear until the next navigation.
          router.refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [productId, router],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
        dragOver
          ? "border-brand-terracotta bg-brand-terracotta/5"
          : "border-border bg-card/40",
      )}
    >
      <Upload className="size-6 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{m.uploader.media.dropHere}</p>
        <p className="text-xs text-muted-foreground">
          {m.uploader.media.hintPhotos}
        </p>
        <p className="text-xs text-muted-foreground">
          {m.uploader.media.hintVideos(VIDEO_MAX_MB, VIDEO_MAX_DURATION_SECONDS)}
        </p>
      </div>

      <label>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
          disabled={busy}
        />
        <Button
          asChild
          variant="secondary"
          disabled={busy}
          className="cursor-pointer"
        >
          <span>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {m.common.uploading}
              </>
            ) : (
              <>
                <Upload className="size-4" />
                {m.uploader.media.chooseFiles}
              </>
            )}
          </span>
        </Button>
      </label>
    </div>
  );
}
