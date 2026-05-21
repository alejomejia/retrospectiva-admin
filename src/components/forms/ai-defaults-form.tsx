"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import {
  IMAGE_QUALITY_VALUES,
  type ImageQuality,
} from "@/lib/ai-models/variables";
import { PANEL_ORDER, type PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";
import {
  AI_ENVIRONMENT_PRESETS,
  AI_FRAMING_PRESETS,
  AI_POSE_PRESETS,
  type AiEnvironmentPreset,
  type AiFramingPreset,
  type AiPosePreset,
} from "@/lib/products/draft-schema";
import { saveAiDefaults } from "@/lib/products/settings-actions";

const MODEL_NONE = "__none__";
const PANEL_AUTO = "__auto__";

export type AiDefaultsFormValues = {
  aiDefaultModelId: string | null;
  aiDefaultSourcePanel: string | null;
  aiDefaultPosePreset: string;
  aiDefaultFramingPreset: string;
  aiDefaultEnvironmentPreset: string;
  aiDefaultImageQuality: string;
};

/**
 * Shop-wide AI placement defaults form. Snapshotted onto each new
 * draft product at creation time (see `createDraftProduct`). Editing
 * here doesn't backfill existing products — matches the
 * `buyPriceDefaults` precedent.
 */
export function AiDefaultsForm({
  initial,
  models,
}: {
  initial: AiDefaultsFormValues;
  models: ActiveAiModelListItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<AiDefaultsFormValues>(initial);

  const t = m.settings.ai;
  const set = <K extends keyof AiDefaultsFormValues>(
    key: K,
    value: AiDefaultsFormValues[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    startTransition(async () => {
      const result = await saveAiDefaults({
        aiDefaultModelId: form.aiDefaultModelId,
        aiDefaultSourcePanel: form.aiDefaultSourcePanel as PanelKey | null,
        aiDefaultPosePreset: form.aiDefaultPosePreset as AiPosePreset,
        aiDefaultFramingPreset: form.aiDefaultFramingPreset as AiFramingPreset,
        aiDefaultEnvironmentPreset:
          form.aiDefaultEnvironmentPreset as AiEnvironmentPreset,
        aiDefaultImageQuality: form.aiDefaultImageQuality as ImageQuality,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.saved);
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ai-default-model">{t.modelLabel}</Label>
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.modelEmpty}</p>
        ) : (
          <Select
            value={form.aiDefaultModelId ?? MODEL_NONE}
            onValueChange={(v) =>
              set("aiDefaultModelId", v === MODEL_NONE ? null : v)
            }
          >
            <SelectTrigger id="ai-default-model" className="w-full">
              <SelectValue placeholder={t.modelPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MODEL_NONE}>{t.modelPlaceholder}</SelectItem>
              {models.map((mm) => (
                <SelectItem key={mm.id} value={mm.id}>
                  {mm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-default-panel">{t.sourcePanelLabel}</Label>
          <Select
            value={form.aiDefaultSourcePanel ?? PANEL_AUTO}
            onValueChange={(v) =>
              set(
                "aiDefaultSourcePanel",
                v === PANEL_AUTO ? null : (v as PanelKey),
              )
            }
          >
            <SelectTrigger id="ai-default-panel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PANEL_AUTO}>{t.sourcePanelAuto}</SelectItem>
              {PANEL_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {
                    m.products.stepper.step1.aiImageSection.panels[p]
                  }
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-default-pose">{t.posePresetLabel}</Label>
          <Select
            value={form.aiDefaultPosePreset}
            onValueChange={(v) => set("aiDefaultPosePreset", v)}
          >
            <SelectTrigger id="ai-default-pose" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_POSE_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {m.products.stepper.step1.aiImageSection.poses[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-default-framing">{t.framingPresetLabel}</Label>
          <Select
            value={form.aiDefaultFramingPreset}
            onValueChange={(v) => set("aiDefaultFramingPreset", v)}
          >
            <SelectTrigger id="ai-default-framing" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_FRAMING_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {m.products.stepper.step1.aiImageSection.framings[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-default-environment">
            {t.environmentPresetLabel}
          </Label>
          <Select
            value={form.aiDefaultEnvironmentPreset}
            onValueChange={(v) => set("aiDefaultEnvironmentPreset", v)}
          >
            <SelectTrigger id="ai-default-environment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_ENVIRONMENT_PRESETS.map((p) => (
                <SelectItem key={p} value={p}>
                  {m.products.stepper.step1.aiImageSection.environments[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-default-quality">{t.imageQualityLabel}</Label>
          <Select
            value={form.aiDefaultImageQuality}
            onValueChange={(v) => set("aiDefaultImageQuality", v)}
          >
            <SelectTrigger id="ai-default-quality" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_QUALITY_VALUES.map((q) => (
                <SelectItem key={q} value={q}>
                  {m.models.new.imageQualities[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
