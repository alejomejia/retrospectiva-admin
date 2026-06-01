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
  AI_ENVIRONMENT_PRESETS,
  type AiEnvironmentPreset,
} from "@/lib/products/draft-schema";

import { useAutosave } from "../autosave";

export function EnvironmentSelect({ value }: { value: string }) {
  const { schedule } = useAutosave();
  const [current, setCurrent] = useState<AiEnvironmentPreset>(
    value as AiEnvironmentPreset,
  );
  const t = m.products.stepper.step1.aiImageSection;

  const handle = (raw: string) => {
    const next = raw as AiEnvironmentPreset;
    setCurrent(next);
    schedule({ aiEnvironmentPreset: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-environment">{t.environmentLabel}</Label>
      <Select value={current} onValueChange={handle}>
        <SelectTrigger id="ai-environment" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AI_ENVIRONMENT_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {t.environments[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
