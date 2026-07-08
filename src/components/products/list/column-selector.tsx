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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, RotateCcw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/lib/i18n/messages.en";

import { useColumnPrefs } from "./column-prefs";
import type { ColumnKey } from "./types";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  thumbnail: m.products.columns.thumbnail,
  title: m.products.columns.title,
  condition: m.products.columns.condition,
  size: m.products.columns.size,
  featured: m.products.columns.featured,
  status: m.products.columns.status,
  basePrice: m.products.columns.basePrice,
  buyPrice: m.products.columns.buyPrice,
  discount: m.products.columns.discount,
  price: m.products.columns.price,
  createdAt: m.products.columns.createdAt,
};

/**
 * Popover with a sortable list of column toggles. Drag to reorder,
 * checkbox to hide/show. Preferences land in `localStorage` via the
 * surrounding `ColumnPrefsProvider`.
 */
export function ColumnSelector() {
  const { prefs, toggle, reorder, reset } = useColumnPrefs();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = prefs.findIndex((p) => p.key === active.id);
    const newIndex = prefs.findIndex((p) => p.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(prefs, oldIndex, newIndex);
    reorder(moved.map((p) => p.key));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label={m.products.columns.openSelectorAriaLabel}
        >
          <Settings2 className="size-4" />
          {m.products.columns.openSelector}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="px-2 py-1.5 text-caplet">
          {m.products.columns.title_heading}
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={prefs.map((p) => p.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-0.5">
              {prefs.map((p) => (
                <SortableRow
                  key={p.key}
                  columnKey={p.key}
                  visible={p.visible}
                  onToggle={() => toggle(p.key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          className="mt-2 w-full justify-start gap-2 text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          {m.products.columns.reset}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({
  columnKey,
  visible,
  onToggle,
}: {
  columnKey: ColumnKey;
  visible: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnKey });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const checkboxId = `col-${columnKey}`;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-sm px-1 py-1.5 hover:bg-muted"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={m.products.columns.dragHandleAriaLabel}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        id={checkboxId}
        checked={visible}
        onCheckedChange={onToggle}
      />
      <Label
        htmlFor={checkboxId}
        className="flex-1 cursor-pointer text-sm font-normal"
      >
        {COLUMN_LABELS[columnKey]}
      </Label>
    </li>
  );
}
