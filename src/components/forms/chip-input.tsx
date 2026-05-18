"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/helpers";

/**
 * Editable list of short text chips. Adding: type + press Enter or
 * comma. Removing: click the ✕ on a chip. Used for Etsy tags and
 * materials, and shaped to be reusable elsewhere if needed.
 *
 * State is fully controlled — the parent owns the array and decides
 * when to persist (e.g. via the autosave context).
 */
export function ChipInput({
  value,
  onChange,
  placeholder,
  maxItems = 13,
  maxItemLength = 30,
  variant = "default",
  ariaLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  maxItemLength?: number;
  variant?: "default" | "secondary" | "outline";
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const next = draft.trim().slice(0, maxItemLength);
    if (!next) return;
    if (value.includes(next)) {
      setDraft("");
      return;
    }
    if (value.length >= maxItems) return;
    onChange([...value, next]);
    setDraft("");
  };

  const removeAt = (index: number) => {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeAt(value.length - 1);
    }
  };

  const atCapacity = value.length >= maxItems;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-card p-2"
    >
      {value.map((chip, i) => (
        <Badge
          key={`${chip}-${i}`}
          variant={variant}
          className="gap-1 font-normal"
        >
          {chip}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className={cn(
              "rounded-full hover:bg-foreground/10",
              "inline-flex size-4 items-center justify-center",
            )}
            aria-label={`Eliminar ${chip}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, maxItemLength))}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        placeholder={atCapacity ? undefined : placeholder}
        disabled={atCapacity}
        maxLength={maxItemLength}
        className="h-7 min-w-[8ch] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
