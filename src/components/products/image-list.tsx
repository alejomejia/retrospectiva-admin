"use client";

import { ArrowDown, ArrowUp, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import {
  deleteProductImage,
  moveProductImage,
  setPrimaryProductImage,
} from "@/lib/products/images-actions";
import { cn } from "@/lib/utils/helpers";

export type ImageListItem = {
  id: string;
  url: string;
  order: number;
  width: number | null;
  height: number | null;
};

/**
 * Renders a product's photos as a grid. Each tile gets ↑ / ↓ to nudge
 * order, a ★ button to promote to primary (order=0), and a trash to
 * delete. Optimistic feel: we wrap each mutation in `useTransition` so
 * the button shows a pending state while the server action runs.
 */
export function ImageList({ images }: { images: ImageListItem[] }) {
  if (images.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{m.imageList.empty}</p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image, idx) => (
        <ImageTile
          key={image.id}
          image={image}
          isFirst={idx === 0}
          isLast={idx === images.length - 1}
        />
      ))}
    </ul>
  );
}

function ImageTile({
  image,
  isFirst,
  isLast,
}: {
  image: ImageListItem;
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

  const ratio =
    image.width && image.height ? image.width / image.height : 3 / 4;

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-md border border-border bg-card",
        pending && "opacity-60",
      )}
    >
      <div
        className="relative w-full bg-brand-paper"
        style={{ aspectRatio: ratio }}
      >
        <Image
          src={image.url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
          unoptimized
        />
        {isFirst ? (
          <Badge className="absolute left-2 top-2 gap-1">
            <Star className="size-3" />
            {m.imageList.primary}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isFirst || pending}
            onClick={() => run(() => moveProductImage(image.id, "up"))}
            aria-label={m.imageList.moveUp}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isLast || pending}
            onClick={() => run(() => moveProductImage(image.id, "down"))}
            aria-label={m.imageList.moveDown}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isFirst || pending}
            onClick={() => run(() => setPrimaryProductImage(image.id))}
            aria-label={m.imageList.setPrimary}
          >
            <Star className="size-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:bg-destructive/10"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(m.imageList.confirmDelete)) return;
            run(() => deleteProductImage(image.id));
          }}
          aria-label={m.imageList.delete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
