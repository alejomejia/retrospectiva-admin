"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIZE_VALUES, type SizeValue } from "@/lib/products/draft-schema";
import { m } from "@/lib/i18n/messages.en";

import { useAutosave } from "./autosave";

/**
 * Single-value size picker. Etsy's "Women's Clothing (US Letter)"
 * attribute accepts exactly one size per listing, so the form
 * mirrors that constraint instead of the legacy multi-select.
 */
export function SizeField({
  value,
  onChange,
}: {
  value: SizeValue | null;
  onChange: (next: SizeValue | null) => void;
}) {
  const { schedule } = useAutosave();

  const onValueChange = (next: string) => {
    const v = (next as SizeValue) || null;
    onChange(v);
    schedule({ size: v });
  };
  
  return (
    <div className="space-y-2">
      <Label htmlFor="size">{m.products.form.size}</Label>
      <Select value={value ?? ""} onValueChange={onValueChange}>
        <SelectTrigger id="size">
          <SelectValue placeholder={m.products.form.sizePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {SIZE_VALUES.map((size) => (
            <SelectItem key={size} value={size}>
              {m.products.sizes[size]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
