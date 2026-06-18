"use client";

import { useState } from "react";

import { m } from "@/lib/i18n/messages.es";

/**
 * 9:16 preview frame. The parent `key`s this on the URL, so switching
 * the selected photo remounts the component — `loaded` starts false on
 * the new source with no effect needed — and shows a loading label
 * until the freshly-rendered PNG decodes.
 */
export function InstagramStoryPreview({ previewUrl }: { previewUrl: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-brand-paper"
      style={{ aspectRatio: 9 / 16 }}
    >
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {m.products.instagramStory.previewLoading}
        </div>
      ) : null}
      {/* Native img (not next/image): the source is a dynamic route that
          renders a one-off PNG, not an optimizable static asset. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={m.products.instagramStory.previewLabel}
        className="h-full w-full object-cover"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
