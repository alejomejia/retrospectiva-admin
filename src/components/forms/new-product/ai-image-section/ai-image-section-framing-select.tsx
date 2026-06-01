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
import { m } from "@/lib/i18n/messages.es";
import {
  AI_FRAMING_PRESETS,
  type AiFramingPreset,
} from "@/lib/products/draft-schema";

import { useAutosave } from "../autosave";

export function FramingSelect({ value }: { value: string }) {
  const { schedule } = useAutosave();
  const [current, setCurrent] = useState<AiFramingPreset>(
    value as AiFramingPreset,
  );
  const t = m.products.stepper.step1.aiImageSection;

  const handle = (raw: string) => {
    const next = raw as AiFramingPreset;
    setCurrent(next);
    schedule({ aiFramingPreset: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-framing">{t.framingLabel}</Label>
      <Select value={current} onValueChange={handle}>
        <SelectTrigger id="ai-framing" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AI_FRAMING_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {t.framings[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
