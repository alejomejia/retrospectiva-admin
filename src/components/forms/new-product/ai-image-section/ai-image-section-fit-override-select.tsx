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
  AI_FIT_OVERRIDES,
  type AiFitOverride,
} from "@/lib/products/draft-schema";

import { useAutosave } from "../autosave";
import { FIT_NONE_VALUE } from "./ai-image-section.const";

export function FitOverrideSelect({ value }: { value: string | null }) {
  const { schedule } = useAutosave();
  const [current, setCurrent] = useState<AiFitOverride | null>(
    value as AiFitOverride | null,
  );
  const t = m.products.stepper.step1.aiImageSection;

  const handle = (raw: string) => {
    const next = raw === FIT_NONE_VALUE ? null : (raw as AiFitOverride);
    setCurrent(next);
    schedule({ aiFitOverride: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-fit-override">{t.fitOverrideLabel}</Label>
      <Select value={current ?? FIT_NONE_VALUE} onValueChange={handle}>
        <SelectTrigger id="ai-fit-override" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FIT_NONE_VALUE}>{t.fitOverrideNone}</SelectItem>
          {AI_FIT_OVERRIDES.map((p) => (
            <SelectItem key={p} value={p}>
              {t.fitOverrides[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
