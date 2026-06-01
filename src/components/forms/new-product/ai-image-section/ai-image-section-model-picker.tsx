"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import { m } from "@/lib/i18n/messages.es";

export function ModelPicker({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: ActiveAiModelListItem[];
  onChange: (next: string | null) => void;
}) {
  const t = m.products.stepper.step1.aiImageSection;

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-model-picker" required>{t.modelLabel}</Label>
      <Select
        value={value ?? ""}
        onValueChange={(raw) => onChange(raw === "" ? null : raw)}
      >
        <SelectTrigger id="ai-model-picker" className="w-full">
          <SelectValue placeholder={t.modelPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
