"use client";

import Image from "next/image";

import type { ImageListItem } from "@/components/products/image-list";
import { m } from "@/lib/i18n/messages.en";

/**
 * Primary product photo pinned at the top of step 2 so the operator can
 * eyeball the AI-generated title/description against the real garment
 * without bouncing back to step 1. Shows the feature image only (the
 * first item in the order-sorted list); renders nothing when the
 * product has no photos yet.
 */
export function FeatureImage({ image }: { image: ImageListItem | null }) {
  if (!image) return null;

  const ratio = image.width && image.height ? image.width / image.height : 3 / 4;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-caplet text-muted-foreground">
        {m.products.stepper.step2.featureImageLabel}
      </figcaption>
      <div
        className="relative max-w-xs overflow-hidden rounded-md border border-border bg-brand-paper"
        style={{ aspectRatio: ratio }}
      >
        <Image
          src={image.url}
          alt=""
          fill
          sizes="320px"
          className="object-cover"
          unoptimized
        />
      </div>
    </figure>
  );
}
