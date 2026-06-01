"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PANEL_ORDER, type PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";

import { PANEL_AUTO_VALUE } from "./ai-image-section.const";

export function SourcePanelSelect({
  value,
  onChange,
}: {
  value: PanelKey | null;
  onChange: (next: PanelKey | null) => void;
}) {
  const t = m.products.stepper.step1.aiImageSection;

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-source-panel" required>{t.sourcePanelLabel}</Label>
      <Select
        value={value ?? PANEL_AUTO_VALUE}
        onValueChange={(raw) =>
          onChange(raw === PANEL_AUTO_VALUE ? null : (raw as PanelKey))
        }
      >
        <SelectTrigger id="ai-source-panel" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PANEL_AUTO_VALUE}>{t.sourcePanelAuto}</SelectItem>
          {PANEL_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              {t.panels[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
