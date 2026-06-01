"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IMAGE_QUALITY_VALUES,
  type ImageQuality,
} from "@/lib/ai-models/variables";
import { m } from "@/lib/i18n/messages.es";

import { useAutosave } from "../autosave";

export function QualitySelect({ value }: { value: string }) {
  const { schedule } = useAutosave();
  const [current, setCurrent] = useState<ImageQuality>(value as ImageQuality);
  const t = m.products.stepper.step1.aiImageSection;

  const handle = (raw: string) => {
    const next = raw as ImageQuality;
    setCurrent(next);
    schedule({ aiImageQuality: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-image-quality">{t.qualityLabel}</Label>
      <Select value={current} onValueChange={handle}>
        <SelectTrigger id="ai-image-quality" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {IMAGE_QUALITY_VALUES.map((q) => (
            <SelectItem key={q} value={q}>
              {m.models.new.imageQualities[q] ?? q}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t.qualityHelp}</p>
    </div>
  );
}
