"use client";

import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { ClothingType } from "@/lib/db/schema";
import type { PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";

import { EnvironmentSelect } from "./ai-image-section-environment-select";
import { FitOverrideSelect } from "./ai-image-section-fit-override-select";
import { FramingSelect } from "./ai-image-section-framing-select";
import { GenerateBlock } from "./ai-image-section-generate-block";
import { ModelPicker } from "./ai-image-section-model-picker";
import { NoModelsEmptyState } from "./ai-image-section-no-models";
import { PanelPreview } from "./ai-image-section-panel-preview";
import { PoseSelect } from "./ai-image-section-pose-select";
import { QualitySelect } from "./ai-image-section-quality-select";
import { ReferenceUploader } from "./ai-image-section-reference-uploader";
import { SourcePanelSelect } from "./ai-image-section-source-panel-select";
import type {
  AiImageSectionProduct,
  AiReferenceImage,
  GeneratedAiImage,
} from "./ai-image-section.types";
import { useAiImageSection } from "./use-ai-image-section";

export type {
  AiImageSectionProduct,
  AiReferenceImage,
  GeneratedAiImage,
} from "./ai-image-section.types";

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
  const enabled = product.aiImageEnabled ?? shopAiImageEnabled;
  const t = m.products.stepper.step1.aiImageSection;

  const vm = useAiImageSection({
    product,
    aiModels,
    referenceImage,
    clothingType,
    onAiRequiredStateChange,
  });

  if (!enabled) {
    return (
      <p className="text-sm text-muted-foreground">{t.disabledHint}</p>
    );
  }

  if (aiModels.length === 0) {
    return <NoModelsEmptyState />;
  }

  return (
    <div className="space-y-6">
      <ModelPicker
        value={vm.modelId}
        options={aiModels}
        onChange={vm.handleModelChange}
      />
      <ReferenceUploader
        productId={product.id}
        referenceImage={referenceImage}
        onChange={vm.handleReferenceChange}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SourcePanelSelect
          value={vm.sourcePanel}
          onChange={vm.handlePanelChange}
        />
        <PoseSelect value={product.aiPosePreset} />
        <FramingSelect value={product.aiFramingPreset} />
        <EnvironmentSelect value={product.aiEnvironmentPreset} />
        <FitOverrideSelect value={product.aiFitOverride} />
        <QualitySelect value={product.aiImageQuality} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PanelPreview
          model={vm.selectedModel}
          panel={vm.resolvedPanel}
          usingDefault={vm.sourcePanel === null}
          r2BaseUrl={r2BaseUrl}
        />
        <GenerateBlock
          productId={product.id}
          canGenerate={
            vm.modelId !== null &&
            referenceImage !== null &&
            clothingType !== null
          }
          initialImage={generatedImage}
          showControls={showGenerateControls}
        />
      </div>
    </div>
  );
}
