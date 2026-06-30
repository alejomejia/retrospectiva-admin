"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import { uploadProductImage } from "@/lib/products/images-actions";
import {
  VIDEO_MAX_DURATION_MS,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_SOURCE_MAX_BYTES,
  VIDEO_SOURCE_MAX_MB,
} from "@/lib/products/media-limits";
import {
  createVideoUpload,
  deleteProductVideo,
  finalizeVideoUpload,
} from "@/lib/products/videos-actions";
import { compressImage } from "@/lib/utils/compress-image";
import { extractVideoPoster } from "@/lib/utils/extract-video-poster";
import { cn } from "@/lib/utils/helpers";

/** Map a file extension to the video mime the server expects, used when
 *  the browser leaves `File.type` empty (common for `.mov` picks). */
const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function videoContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_MIME_BY_EXT[ext] ?? "";
}

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
 *   - videos → browser-side poster extraction (Canvas @ 1s), then a
 *     three-phase direct-to-R2 upload: `createVideoUpload` (presigned
 *     PUT URL) → PUT the raw bytes straight to R2 → `finalizeVideoUpload`
 *     (queues the worker transcode). The raw clip never touches the app
 *     server, so a large video can't OOM it.
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
              // Client-side pre-checks run on the RAW clip BEFORE any
              // bytes hit the wire (poster extraction also hands us the
              // duration). The raw source uploads DIRECTLY to R2 via a
              // presigned URL — never through the app server — and the
              // worker transcodes it to a 1080p H.264/MP4. We only guard
              // here against files too long or larger than the source cap.
              const { poster, durationMs } = await extractVideoPoster(raw);
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
              if (raw.size > VIDEO_SOURCE_MAX_BYTES) {
                toast.error(
                  `${raw.name}: ${m.errors.videoTooLarge(
                    (raw.size / 1024 / 1024).toFixed(1),
                    VIDEO_SOURCE_MAX_MB,
                  )}`,
                );
                continue;
              }

              // Phase 1: register the upload + get a presigned R2 PUT URL.
              const created = await createVideoUpload({
                productId,
                contentType: videoContentType(raw),
                sizeBytes: raw.size,
                poster,
                durationMs,
              });
              if (!created.ok) {
                toast.error(`${raw.name}: ${created.error}`);
                continue;
              }

              // Phase 2: upload the raw bytes straight to R2. On failure,
              // drop the orphaned `processing` row so it doesn't linger.
              try {
                const put = await fetch(created.uploadUrl, {
                  method: "PUT",
                  body: raw,
                  headers: { "Content-Type": created.contentType },
                });
                if (!put.ok) {
                  throw new Error(`R2 PUT ${put.status}`);
                }
              } catch (putErr) {
                await deleteProductVideo(created.videoId);
                toast.error(
                  `${raw.name}: ${
                    putErr instanceof Error
                      ? putErr.message
                      : m.errors.uploadFailed
                  }`,
                );
                continue;
              }

              // Phase 3: kick off the transcode. The tile shows as
              // "processing" until the worker finishes.
              await finalizeVideoUpload(created.videoId);
              toast.info(`${raw.name}: ${m.toasts.videoProcessing}`);
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
          {m.uploader.media.hintVideos(VIDEO_SOURCE_MAX_MB, VIDEO_MAX_DURATION_SECONDS)}
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
