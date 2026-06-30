"use client";

import { ArrowDown, ArrowUp, Loader2, TriangleAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import {
  deleteProductVideo,
  moveProductVideo,
} from "@/lib/products/videos-actions";
import { cn } from "@/lib/utils/helpers";

import { useVideoStatusPolling } from "./use-video-status-polling";

export type VideoListItem = {
  id: string;
  /** Transcode lifecycle. Only `ready` rows have a playable `url`. */
  status: "processing" | "ready" | "failed";
  /** Failure reason when `status === "failed"`. */
  error: string | null;
  /** Public URL of the transcoded MP4. Null until `ready`. */
  url: string | null;
  posterUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  order: number;
};

/**
 * Video gallery — one tile per video. A `ready` tile is a `<video controls>`
 * player with reorder + delete; a `processing` tile shows the poster behind
 * a spinner while the worker transcodes (the list polls and re-fetches once
 * it flips); a `failed` tile shows the error with a delete to clear it.
 *
 * Reorder + delete go through server actions and feel optimistic via
 * `useTransition`.
 */
export function VideoList({
  productId,
  videos,
}: {
  productId: string;
  videos: VideoListItem[];
}) {
  const router = useRouter();
  const hasProcessing = videos.some((v) => v.status === "processing");
  const poll = useVideoStatusPolling(productId, { enabled: hasProcessing });

  // When the polled statuses diverge from what's currently rendered (a
  // transcode finished or failed), re-fetch the server props so the
  // finished player — with its real URL/dimensions — swaps in.
  useEffect(() => {
    if (!poll) return;
    const sig = (rows: { id: string; status: string }[]) =>
      rows
        .map((r) => `${r.id}:${r.status}`)
        .sort()
        .join(",");
    if (sig(videos) !== sig(poll.videos)) router.refresh();
  }, [poll, videos, router]);

  if (videos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{m.videoList.empty}</p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {videos.map((video, idx) => (
        <VideoTile
          key={video.id}
          video={video}
          isFirst={idx === 0}
          isLast={idx === videos.length - 1}
          enableDrag={videos.length > 1}
        />
      ))}
    </ul>
  );
}

function VideoTile({
  video,
  isFirst,
  isLast,
  enableDrag,
}: {
  video: VideoListItem;
  isFirst: boolean;
  isLast: boolean;
  enableDrag: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(result.error);
    });
  };

  const isReady = video.status === "ready";
  const isProcessing = video.status === "processing";

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-border bg-card",
        pending && "opacity-60",
      )}
    >
      <div className="relative w-full bg-brand-paper">
        {isReady && video.url ? (
          <video
            src={video.url}
            poster={video.posterUrl ?? undefined}
            controls
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="relative aspect-square w-full">
            {video.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.posterUrl}
                alt=""
                className={cn(
                  "h-full w-full object-cover",
                  isProcessing && "opacity-05",
                )}
              />
            ) : null}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              {isProcessing ? (
                <>
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {m.videoList.processing}
                  </span>
                </>
              ) : (
                <>
                  <TriangleAlert className="size-5 text-destructive" />
                  <span className="text-xs font-medium text-destructive">
                    {m.videoList.failed}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="space-y-1 text-sm">
          <p className="text-caplet">{m.videoList.label}</p>
          {isReady ? (
            <p className="text-muted-foreground">
              {(video.mimeType ?? "").replace("video/", "").toUpperCase()}
              {video.width && video.height
                ? ` · ${video.width}×${video.height}`
                : ""}
              {video.durationMs
                ? ` · ${(video.durationMs / 1000).toFixed(1)}s`
                : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isProcessing
                ? m.videoList.processingHint
                : (video.error ?? m.videoList.failedHint)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {isReady && enableDrag && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={isFirst || pending}
                onClick={() => run(() => moveProductVideo(video.id, "up"))}
                aria-label={m.videoList.moveUp}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={isLast || pending}
                onClick={() => run(() => moveProductVideo(video.id, "down"))}
                aria-label={m.videoList.moveDown}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(m.videoList.confirmDelete)) return;
              run(() => deleteProductVideo(video.id));
            }}
            aria-label={m.videoList.delete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
