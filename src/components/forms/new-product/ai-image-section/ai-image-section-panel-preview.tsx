import Image from "next/image";

import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";

import { PANEL_TO_KEY } from "./ai-image-section.const";

export function PanelPreview({
  model,
  panel,
  usingDefault,
  r2BaseUrl,
}: {
  model: ActiveAiModelListItem | null;
  panel: PanelKey | null;
  usingDefault: boolean;
  r2BaseUrl: string;
}) {
  const t = m.products.stepper.step1.aiImageSection;
  if (!model || !panel) return null;
  // Crops missing → fall back to the contact sheet; without a sheet
  // there's nothing meaningful to render.
  const r2Key = model.cropsAvailable
    ? model[PANEL_TO_KEY[panel]]
    : model.contactSheetKey;
  if (!r2Key) return null;
  const url = `${r2BaseUrl.replace(/\/$/, "")}/${r2Key.replace(/^\//, "")}`;
  const labelPanel = t.panels[panel];
  return (
    <div className="space-y-2">
      <p className="text-caplet">
        {t.previewLabel}: {model.label} · {labelPanel}
        {usingDefault ? ` · ${t.previewAutoSuffix}` : ""}
      </p>
      <div className="w-fit overflow-hidden rounded-md border bg-muted">
        <Image
          src={url}
          alt={`${model.label} — ${labelPanel}`}
          width={400}
          height={520}
          className="h-auto w-full max-w-xs object-cover"
          unoptimized
        />
      </div>
    </div>
  );
}
