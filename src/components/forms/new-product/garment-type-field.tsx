"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import {
  CLOTHING_TYPES,
  getCategoryLabel,
  getClothingTypeLabel,
  getClothingTypesByCategory,
  type GarmentCategory,
} from "@/lib/products/clothing-types";
import type { ClothingType } from "@/lib/db/schema";

import { useAutosave } from "./autosave";

const CATEGORY_ORDER: GarmentCategory[] = [
  "upper",
  "lower",
  "complete",
  "special",
];

/**
 * Grouped select for clothing type. Picking a value triggers
 * autosave + the parent re-derives the measurement field list.
 */
export function GarmentTypeField({
  value,
  onChange,
}: {
  value: ClothingType | null;
  onChange: (next: ClothingType) => void;
}) {
  const { schedule } = useAutosave();
  const handleChange = (next: string) => {
    const ct = next as ClothingType;
    onChange(ct);
    schedule({ clothingType: ct });
  };
  return (
    <div className="space-y-2">
      <Label htmlFor="clothing-type" className="text-caplet" required>
        {m.products.form.clothingType}
      </Label>
      <Select value={value ?? undefined} onValueChange={handleChange}>
        <SelectTrigger id="clothing-type">
          <SelectValue placeholder={m.products.form.clothingTypePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_ORDER.map((category) => {
            const items = getClothingTypesByCategory(category);
            if (items.length === 0) return null;
            return (
              <SelectGroup key={category}>
                <SelectLabel>{getCategoryLabel(category)}</SelectLabel>
                {items.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {getClothingTypeLabel(entry.value)}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
          {/* Belt and suspenders: if a value is somehow missing from the
              category-grouped list, ensure it can still be selected. */}
          {value && !CLOTHING_TYPES.some((c) => c.value === value) ? (
            <SelectItem value={value}>{value}</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
