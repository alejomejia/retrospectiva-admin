"use client";

import {
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { AiImageStatusResponse } from "@/app/(admin)/products/[id]/ai-image-status/route";

import { AiImageOverrideField } from "@/components/forms/new-product/ai-image-override-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ClothingType } from "@/lib/db/schema";
import { PANEL_ORDER, type PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";
import { getDefaultAiSourcePanel } from "@/lib/products/clothing-types";
import { generateProductImage } from "@/lib/products/image-placement-actions";
import {
  deleteAiReferenceImage,
  uploadAiReferenceImage,
} from "@/lib/products/images-actions";
import {
  AI_ENVIRONMENT_PRESETS,
  AI_FIT_OVERRIDES,
  AI_FRAMING_PRESETS,
  AI_POSE_PRESETS,
  type AiEnvironmentPreset,
  type AiFitOverride,
  type AiFramingPreset,
  type AiPosePreset,
} from "@/lib/products/draft-schema";
import { compressImage } from "@/lib/utils/compress-image";

import { useAutosave } from "./autosave-context";

const FIT_NONE_VALUE = "__none__";
const PANEL_AUTO_VALUE = "__auto__";

export type AiImageSectionProduct = {
  id: string;
  aiImageEnabled: boolean | null;
  aiModelId: string | null;
  aiSourcePanel: string | null;
  aiPosePreset: string;
  aiFramingPreset: string;
  aiEnvironmentPreset: string;
  aiFitOverride: string | null;
  aiImageQuality: string;
};

export type AiReferenceImage = {
  url: string;
  width: number | null;
  height: number | null;
} | null;

export type GeneratedAiImage = {
  url: string;
  width: number | null;
  height: number | null;
} | null;

/** Polling cadence + ceiling for the generation flow. Mirrors the
 *  enrich-regenerate path on the edit form. */
const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 96; // ~4 minutes; gpt-image-2 high portrait ~60s

/** Map PanelKey → ActiveAiModelListItem column carrying the R2 key. */
const PANEL_TO_KEY: Record<
  PanelKey,
  keyof Pick<
    ActiveAiModelListItem,
    | "frontFullKey"
    | "frontPortraitKey"
    | "frontEditorialKey"
    | "sidePortraitKey"
    | "backFullKey"
    | "threequarterFullKey"
  >
> = {
  front_full: "frontFullKey",
  front_portrait: "frontPortraitKey",
  front_editorial: "frontEditorialKey",
  side_portrait: "sidePortraitKey",
  back_full: "backFullKey",
  threequarter_full: "threequarterFullKey",
};

/**
 * Step-1 "Imagen IA" card. Bundles the per-product AI-image override
 * toggle, the model picker, the AI-reference uploader, and the five
 * preset selects (source panel, pose, framing, environment, fit
 * override) that drive `assembleImagePlacementPrompt`.
 *
 * Gating rule (matches Phase 2 spec): when EITHER the shop-wide
 * toggle is off AND no per-product override flips it on, OR the
 * per-product override is explicitly off, the configuration controls
 * are hidden — the placement worker short-circuits at enqueue time so
 * the inputs are dead weight.
 *
 * Autosave: every change is persisted through the shared autosave
 * context (debounced 500ms). The reference uploader bypasses autosave
 * — it has its own server action that mutates `product_images`
 * directly.
 */
export function AiImageSection({
  product,
  shopAiImageEnabled,
  aiModels,
  referenceImage,
  generatedImage,
  clothingType,
  r2BaseUrl,
  showGenerateControls = true,
  onAiRequiredStateChange,
}: {
  product: AiImageSectionProduct;
  shopAiImageEnabled: boolean;
  aiModels: ActiveAiModelListItem[];
  referenceImage: AiReferenceImage;
  generatedImage: GeneratedAiImage;
  /** Tracks step-1's local clothingType so the "auto" panel preview
   *  reflects the current selection without a round trip. */
  clothingType: ClothingType | null;
  r2BaseUrl: string;
  /**
   * Toggle the Generar / Regenerar button row. The step-1 stepper
   * passes `false` because placement is auto-enqueued alongside
   * enrichment on the Next click — a button here would only invite
   * burning a duplicate call. The flat edit form keeps the controls
   * (`true`, the default) since there's no Next-step pipeline.
   * Either way, an existing `generatedImage` is always previewed.
   */
  showGenerateControls?: boolean;
  /** Stepper observer: fires when the trio of fields the step-1
   *  Next button gates on changes. Lets the parent flip its
   *  `canProceed` flag without lifting all three states up. */
  onAiRequiredStateChange?: (state: {
    modelId: string | null;
    sourcePanel: PanelKey | null;
    hasReference: boolean;
  }) => void;
}) {
  const { schedule } = useAutosave();
  const enabled = product.aiImageEnabled ?? shopAiImageEnabled;
  const t = m.products.stepper.step1.aiImageSection;

  // Model + source panel state lives at this level so the preview can
  // join them. The individual selects stay controlled and call back
  // into the parent's setters (which also drive autosave).
  const [modelId, setModelId] = useState<string | null>(product.aiModelId);
  const [sourcePanel, setSourcePanel] = useState<PanelKey | null>(
    product.aiSourcePanel as PanelKey | null,
  );
  const [hasReference, setHasReference] = useState<boolean>(
    referenceImage !== null,
  );

  useEffect(() => {
    onAiRequiredStateChange?.({ modelId, sourcePanel, hasReference });
  }, [modelId, sourcePanel, hasReference, onAiRequiredStateChange]);

  const handleModelChange = (next: string | null) => {
    setModelId(next);
    schedule({ aiModelId: next });
  };
  const handlePanelChange = (next: PanelKey | null) => {
    setSourcePanel(next);
    schedule({ aiSourcePanel: next });
  };

  const selectedModel =
    modelId !== null ? aiModels.find((mm) => mm.id === modelId) ?? null : null;
  const resolvedPanel: PanelKey | null = sourcePanel
    ? sourcePanel
    : clothingType
      ? getDefaultAiSourcePanel(clothingType)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AiImageOverrideField
          value={product.aiImageEnabled}
          shopAiImageEnabled={shopAiImageEnabled}
        />

        {enabled ? (
          aiModels.length === 0 ? (
            <NoModelsEmptyState />
          ) : (
            <div className="space-y-6 border-t pt-6">
              <ModelPicker
                value={modelId}
                options={aiModels}
                onChange={handleModelChange}
              />
              <ReferenceUploader
                productId={product.id}
                referenceImage={referenceImage}
                onChange={(next) => setHasReference(next !== null)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SourcePanelSelect
                  value={sourcePanel}
                  onChange={handlePanelChange}
                />
                <PoseSelect value={product.aiPosePreset} />
                <FramingSelect value={product.aiFramingPreset} />
                <EnvironmentSelect value={product.aiEnvironmentPreset} />
                <FitOverrideSelect value={product.aiFitOverride} />
                <QualitySelect value={product.aiImageQuality} />
              </div>
              <PanelPreview
                model={selectedModel}
                panel={resolvedPanel}
                usingDefault={sourcePanel === null}
                r2BaseUrl={r2BaseUrl}
              />
              <GenerateBlock
                productId={product.id}
                canGenerate={
                  modelId !== null &&
                  referenceImage !== null &&
                  clothingType !== null
                }
                initialImage={generatedImage}
                showControls={showGenerateControls}
              />
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t.disabledHint}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Field components -------------------------------------------

function NoModelsEmptyState() {
  const t = m.products.stepper.step1.aiImageSection;
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed bg-card/40 p-6">
      <div className="flex items-center gap-2 text-caplet">
        <UserPlus className="size-4" />
        {t.modelEmptyTitle}
      </div>
      <p className="text-sm text-muted-foreground">{t.modelEmptyBody}</p>
      <Button asChild size="sm" variant="secondary">
        <Link href="/models/new">
          <UserPlus className="size-4" />
          {t.modelEmptyCta}
        </Link>
      </Button>
    </div>
  );
}

function ModelPicker({
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

function ReferenceUploader({
  productId,
  referenceImage,
  onChange,
}: {
  productId: string;
  referenceImage: AiReferenceImage;
  onChange?: (next: AiReferenceImage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<AiReferenceImage>(referenceImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = m.products.stepper.step1.aiImageSection;

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const { file: compressed, width, height } = await compressImage(file);
      const result = await uploadAiReferenceImage({
        productId,
        file: compressed,
        width,
        height,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Optimistic refresh: blob URL gives instant feedback; the next
      // page navigation will pick up the real R2 URL from the DB.
      const next: AiReferenceImage = {
        url: URL.createObjectURL(compressed),
        width: width ?? null,
        height: height ?? null,
      };
      setCurrent(next);
      onChange?.(next);
      toast.success(t.referenceUploaded);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const result = await deleteAiReferenceImage(productId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrent(null);
      onChange?.(null);
      toast.success(t.referenceRemoved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <Label required>{t.referenceTitle}</Label>
        <p className="text-sm text-muted-foreground">
          {t.referenceDescription}
        </p>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {current ? (
            <Image
              src={current.url}
              alt=""
              width={current.width ?? 112}
              height={current.height ?? 112}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                void handleFile(e.target.files[0]);
              }
              e.target.value = "";
            }}
            disabled={busy}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.referenceUploading}
              </>
            ) : (
              <>
                <Upload className="size-4" />
                {current ? t.referenceReplace : t.referenceChoose}
              </>
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="size-4" />
              {t.referenceRemove}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourcePanelSelect({
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

function PanelPreview({
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
      <div className="overflow-hidden rounded-md border bg-muted">
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

function PoseSelect({ value }: { value: string }) {
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

function FramingSelect({ value }: { value: string }) {
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

function EnvironmentSelect({ value }: { value: string }) {
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

function GenerateBlock({
  productId,
  canGenerate,
  initialImage,
  showControls,
}: {
  productId: string;
  canGenerate: boolean;
  initialImage: GeneratedAiImage;
  showControls: boolean;
}) {
  const t = m.products.stepper.step1.aiImageSection;
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<GeneratedAiImage>(initialImage);

  const handle = async (force: boolean) => {
    if (force) {
      if (!window.confirm(t.regenerateConfirm)) return;
    }
    setBusy(true);
    try {
      const startedAt = Date.now();
      const enqueued = await generateProductImage(productId, { force });
      if (!enqueued.ok) {
        toast.error(enqueued.error);
        return;
      }
      toast.message(t.startedToast);
      const result = await pollPlacementUntilDone(productId, startedAt);
      if (!result.ok) {
        toast.error(t.failedToast);
        return;
      }
      setCurrent(result.image);
      toast.success(t.successToast);
    } finally {
      setBusy(false);
    }
  };

  // No controls AND no existing image → render nothing. Avoids an
  // empty `<div className="space-y-3" />` taking layout space in
  // the stepper, where placement is auto-enqueued and the user
  // hasn't seen output yet.
  if (!showControls && !current) return null;

  return (
    <div className="space-y-3">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => handle(false)}
            disabled={busy || !canGenerate}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.generating}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {current ? t.regenerate : t.generate}
              </>
            )}
          </Button>
          {current && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handle(true)}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              {t.regenerate}
            </Button>
          )}
        </div>
      )}
      {current && (
        <div className="space-y-2">
          <p className="text-caplet">{t.generatedTitle}</p>
          <div className="overflow-hidden rounded-md border bg-muted">
            <Image
              src={current.url}
              alt=""
              width={current.width ?? 400}
              height={current.height ?? 600}
              className="h-auto w-full max-w-xs"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Poll the placement status route until the run that started AFTER
 *  `startedAt` finishes. Returns the freshly generated image on
 *  success; null on failure or timeout. */
async function pollPlacementUntilDone(
  productId: string,
  startedAt: number,
): Promise<
  { ok: true; image: GeneratedAiImage } | { ok: false }
> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`/products/${productId}/ai-image-status`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as AiImageStatusResponse;
      const finishedAt = data.run?.finishedAt
        ? new Date(data.run.finishedAt).getTime()
        : 0;
      // Ignore stale rows that finished before we even kicked the job.
      if (finishedAt < startedAt) continue;
      if (data.run?.status === "succeeded") {
        return { ok: true, image: data.image };
      }
      if (data.run?.status === "failed") return { ok: false };
    } catch {
      // network blip — keep polling
    }
  }
  return { ok: false };
}

function QualitySelect({ value }: { value: string }) {
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

function FitOverrideSelect({ value }: { value: string | null }) {
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
