"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import {
  deleteProductImage,
  reorderProductImages,
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

export function ImageList({ images }: { images: ImageListItem[] }) {
  const [items, setItems] = useState(images);
  const [pending, startTransition] = useTransition();

  // Sync server-provided `images` into local `items` whenever the
  // prop changes (e.g. after MediaUploader's router.refresh brings in
  // newly uploaded photos). Without this, local state from the first
  // render shadows every future prop update and the gallery never
  // reflects new uploads. Reorder/delete still feel optimistic
  // because they update `items` directly, then the revalidated prop
  // arrives matching the optimistic order.
  useEffect(() => {
    setItems(images);
  }, [images]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) toast.error(result.error);
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((img) => img.id === active.id);
    const newIndex = items.findIndex((img) => img.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(items, oldIndex, newIndex);
    setItems(moved);
    run(() => reorderProductImages(moved.map((img) => img.id)));
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{m.imageList.empty}</p>
    );
  }

  return (
    <DndContext
      id="image-list-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((img) => img.id)}
        strategy={rectSortingStrategy}
      >
        <ul
          className={cn(
            "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4",
            pending && "pointer-events-none",
          )}
        >
          {items.map((image, idx) => (
            <SortableImageTile
              key={image.id}
              image={image}
              isFirst={idx === 0}
              onSetPrimary={() => {
                setItems((prev) => {
                  const i = prev.findIndex((img) => img.id === image.id);
                  if (i <= 0) return prev;
                  return [prev[i], ...prev.slice(0, i), ...prev.slice(i + 1)];
                });
                run(() => setPrimaryProductImage(image.id));
              }}
              onDelete={() => {
                if (!window.confirm(m.imageList.confirmDelete)) return;
                setItems((prev) => prev.filter((i) => i.id !== image.id));
                run(() => deleteProductImage(image.id));
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableImageTile({
  image,
  isFirst,
  onSetPrimary,
  onDelete,
}: {
  image: ImageListItem;
  isFirst: boolean;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const ratio =
    image.width && image.height ? image.width / image.height : 3 / 4;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-md border border-border bg-card"
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label={m.imageList.dragHandle}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          {!isFirst && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onSetPrimary}
              aria-label={m.imageList.setPrimary}
            >
              <Star className="size-3.5" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          aria-label={m.imageList.delete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
