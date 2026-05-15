"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import {
  deleteProductVideo,
  moveProductVideo,
} from "@/lib/products/videos-actions";
import { cn } from "@/lib/utils/helpers";

export type VideoListItem = {
  id: string;
  url: string;
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  order: number;
};

/**
 * Video gallery — one row per video, with a <video controls> player, the
 * poster image as `poster=` (so the first frame doesn't have to load on
 * page render), and ↑ / ↓ / 🗑 controls.
 *
 * Reorder + delete go through server actions and feel optimistic via
 * `useTransition`.
 */
export function VideoList({ videos }: { videos: VideoListItem[] }) {
  if (videos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{m.videoList.empty}</p>
    );
  }

  return (
    <ul className="space-y-4">
      {videos.map((video, idx) => (
        <VideoTile
          key={video.id}
          video={video}
          isFirst={idx === 0}
          isLast={idx === videos.length - 1}
        />
      ))}
    </ul>
  );
}

function VideoTile({
  video,
  isFirst,
  isLast,
}: {
  video: VideoListItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(result.error);
    });
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-md border border-border bg-card sm:flex-row",
        pending && "opacity-60",
      )}
    >
      <div className="aspect-video w-full bg-brand-paper sm:w-72">
        <video
          src={video.url}
          poster={video.posterUrl ?? undefined}
          controls
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="space-y-1 text-sm">
          <p className="text-caplet">{m.videoList.label}</p>
          <p className="text-muted-foreground">
            {video.mimeType.replace("video/", "").toUpperCase()}
            {video.width && video.height
              ? ` · ${video.width}×${video.height}`
              : ""}
            {video.durationMs
              ? ` · ${(video.durationMs / 1000).toFixed(1)}s`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
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
