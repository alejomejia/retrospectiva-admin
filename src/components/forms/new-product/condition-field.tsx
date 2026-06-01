"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";
import { productCondition, type ProductCondition } from "@/lib/db/schema";

import { useAutosave } from "./autosave";

export function ConditionField({
  value,
  onChange,
}: {
  value: ProductCondition | null;
  onChange: (next: ProductCondition) => void;
}) {
  const { schedule } = useAutosave();
  const handleChange = (next: string) => {
    const c = next as ProductCondition;
    onChange(c);
    schedule({ condition: c });
  };
  return (
    <div className="space-y-2">
      <Label htmlFor="condition" className="text-caplet" required>
        {m.products.form.condition}
      </Label>
      <Select value={value ?? undefined} onValueChange={handleChange}>
        <SelectTrigger id="condition">
          <SelectValue placeholder={m.products.form.conditionPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {productCondition.enumValues.map((c) => (
            <SelectItem key={c} value={c}>
              {m.products.conditions[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
