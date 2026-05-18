"use client";

import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";
import { SIZE_VALUES, type SizeValue } from "@/lib/products/draft-schema";

import { useAutosave } from "./autosave-context";

export function SizesField({
  value,
  onChange,
}: {
  value: SizeValue[];
  onChange: (next: SizeValue[]) => void;
}) {
  const { schedule } = useAutosave();
  const toggle = (size: SizeValue) => {
    const next = value.includes(size)
      ? value.filter((s) => s !== size)
      : [...value, size];
    onChange(next);
    schedule({ sizes: next });
  };
  return (
    <div className="space-y-2">
      <span className="text-caplet block">{m.products.form.sizes}</span>
      <div role="group" aria-label={m.products.form.sizes} className="flex flex-wrap gap-2">
        {SIZE_VALUES.map((size) => {
          const active = value.includes(size);
          const id = `size-${size}`;
          return (
            <Label
              key={size}
              htmlFor={id}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <input
                id={id}
                type="checkbox"
                checked={active}
                onChange={() => toggle(size)}
                className="sr-only"
              />
              {m.products.sizes[size]}
            </Label>
          );
        })}
      </div>
    </div>
  );
}
