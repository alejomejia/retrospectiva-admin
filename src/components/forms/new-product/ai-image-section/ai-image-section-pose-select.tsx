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
import { AI_POSE_PRESETS, type AiPosePreset } from "@/lib/products/draft-schema";

import { useAutosave } from "../autosave";

export function PoseSelect({ value }: { value: string }) {
  const { schedule } = useAutosave();
  const [current, setCurrent] = useState<AiPosePreset>(value as AiPosePreset);
  const t = m.products.stepper.step1.aiImageSection;

  const handle = (raw: string) => {
    const next = raw as AiPosePreset;
    setCurrent(next);
    schedule({ aiPosePreset: next });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-pose">{t.poseLabel}</Label>
      <Select value={current} onValueChange={handle}>
        <SelectTrigger id="ai-pose" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AI_POSE_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {t.poses[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
