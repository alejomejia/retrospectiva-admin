"use client";

import { useCallback, useState } from "react";

import type { PanelKey } from "@/lib/integrations/openai/panel-keys";

import { MediaUploader } from "@/components/forms/media-uploader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageList, type ImageListItem } from "@/components/products/image-list";
import { VideoList, type VideoListItem } from "@/components/products/video-list";
import type {
  ClothingType,
  Product,
  ProductCondition,
} from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { enqueueEnrichJob } from "@/lib/products/draft-actions";
import { generateProductImage } from "@/lib/products/image-placement-actions";
import { STEP_1_REQUIRED, type SizeValue } from "@/lib/products/draft-schema";
import type { ProductMeasurements } from "@/lib/products/measurements";
import { toast } from "sonner";

import {
  AiImageSection,
  type AiReferenceImage,
  type GeneratedAiImage,
} from "./ai-image-section";
import { useAutosave } from "./autosave-context";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import { BuyPriceField } from "./buy-price-field";
import { ConditionField } from "./condition-field";
import { GarmentTypeField } from "./garment-type-field";
import { MeasurementsField } from "./measurements-field";
import { PriceField } from "./price-field";
import { SizesField } from "./sizes-field";

/**
 * Step 1 — user inputs. Owns local state for instant UI feedback;
 * the autosave context persists each change in the background.
 */
export function Step1Inputs({
  product,
  shopMarkupPercent,
  shopAiImageEnabled,
  buyPriceDefaults,
  imageItems,
  videoItems,
  aiModels,
  aiReferenceImage,
  aiGeneratedImage,
  r2BaseUrl,
  onNext,
}: {
  product: Product;
  shopMarkupPercent: number;
  shopAiImageEnabled: boolean;
  buyPriceDefaults: Record<ClothingType, number | null>;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
  aiModels: ActiveAiModelListItem[];
  aiReferenceImage: AiReferenceImage;
  aiGeneratedImage: GeneratedAiImage;
  r2BaseUrl: string;
  onNext: () => void;
}) {
  const { schedule, flush } = useAutosave();
  const [submitting, setSubmitting] = useState(false);

  // Local state mirrors the product row; autosave handles persistence.
  // Note: the product title is intentionally not editable here — AI
  // generates it in step 2.
  const [clothingType, setClothingType] = useState<ClothingType | null>(
    product.clothingType,
  );
  const [condition, setCondition] = useState<ProductCondition | null>(
    product.condition,
  );
  const [sizes, setSizes] = useState<SizeValue[]>(
    (product.sizes as SizeValue[] | null) ?? [],
  );
  const [basePriceCents, setBasePriceCents] = useState<number | null>(
    product.basePriceCents,
  );
  const [markupOverride, setMarkupOverride] = useState<number | null>(
    product.markupPercentOverride,
  );
  const [buyPriceCents, setBuyPriceCents] = useState<number | null>(
    product.buyPriceCents,
  );
  const [aiModelId, setAiModelId] = useState<string | null>(product.aiModelId);
  const [aiSourcePanel, setAiSourcePanel] = useState<PanelKey | null>(
    product.aiSourcePanel as PanelKey | null,
  );
  const [aiHasReference, setAiHasReference] = useState<boolean>(
    aiReferenceImage !== null,
  );
  const handleAiRequiredStateChange = useCallback(
    (s: { modelId: string | null; sourcePanel: PanelKey | null; hasReference: boolean }) => {
      setAiModelId(s.modelId);
      setAiSourcePanel(s.sourcePanel);
      setAiHasReference(s.hasReference);
    },
    [],
  );
  const [measurements, setMeasurements] = useState<ProductMeasurements>({
    shoulderCm: product.shoulderCm,
    chestCm: product.chestCm,
    waistCm: product.waistCm,
    hipCm: product.hipCm,
    riseCm: product.riseCm,
    legCm: product.legCm,
    lengthCm: product.lengthCm,
    braSize: product.braSize,
  });

  const handleClothingTypeChange = (ct: ClothingType) => {
    setClothingType(ct);
    // Always overwrite the per-product buy price with the type's
    // default on each change. `null` when no default is set —
    // intentionally clears the input.
    const def = buyPriceDefaults[ct] ?? null;
    setBuyPriceCents(def);
    schedule({ buyPriceCents: def });
  };

  const requiredFilled =
    !!clothingType &&
    !!condition &&
    basePriceCents !== null &&
    basePriceCents > 0;
  const hasImage = imageItems.length > 0;

  // Per-product AI image generation is gated by BOTH the shop-wide
  // toggle (resolved at page load) AND the per-product override —
  // mirrors the server-side gate in `generateProductImage`. Used
  // here to decide whether `handleNext` should fan out to the
  // placement queue alongside the enrichment one.
  const aiImageOn = product.aiImageEnabled ?? shopAiImageEnabled;
  const aiRequiredFilled =
    !aiImageOn || (!!aiModelId && aiHasReference && !!aiSourcePanel);
  const canProceed = requiredFilled && hasImage && aiRequiredFilled;
  const canAutoEnqueuePlacement =
    aiImageOn && !!aiModelId && aiHasReference && !!clothingType;

  async function handleNext() {
    setSubmitting(true);
    const flushed = await flush();
    if (!flushed) {
      setSubmitting(false);
      return;
    }
    // Kick off the AI enrichment job. If enqueue fails, stay on
    // step 1 + surface the error — otherwise step 2 would poll
    // until the 2-min timeout for a job that never ran.
    const enqueued = await enqueueEnrichJob(product.id);
    if (!enqueued.ok) {
      setSubmitting(false);
      toast.error(enqueued.error);
      return;
    }
    // Fan out the placement job in parallel with enrichment when
    // the user has everything wired up. Idempotent on the server
    // side (succeeded runs short-circuit) so the duplicate enqueue
    // on a back-then-Next re-entry is a no-op. We deliberately do
    // NOT block step navigation on this call: enrichment is the
    // gating signal for step 2; placement only feeds the image
    // preview, which polls on its own.
    if (canAutoEnqueuePlacement) {
      const placement = await generateProductImage(product.id);
      if (!placement.ok) {
        // Quiet warning, not an error toast — the user can still
        // hit Generar imagen manually on step 1 (or later).
        toast.message(placement.error);
      }
    }
    setSubmitting(false);
    onNext();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{m.products.stepper.step1.title}</CardTitle>
          <CardDescription>
            {m.products.stepper.step1.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <GarmentTypeField
              value={clothingType}
              onChange={handleClothingTypeChange}
            />
            <ConditionField value={condition} onChange={setCondition} />
          </div>

          <SizesField value={sizes} onChange={setSizes} />

          <PriceField
            basePriceCents={basePriceCents}
            markupPercentOverride={markupOverride}
            shopMarkupPercent={shopMarkupPercent}
            currency={product.currency}
            onBaseChange={setBasePriceCents}
            onMarkupChange={setMarkupOverride}
          />

          <BuyPriceField
            // Remount on clothing-type-driven overwrites so the input
            // reflects the new default; user blur sets state locally.
            key={`buy-${clothingType ?? "none"}`}
            buyPriceCents={buyPriceCents}
            basePriceCents={basePriceCents}
            currency={product.currency}
            onChange={setBuyPriceCents}
          />

          <div className="space-y-2">
            <p className="text-caplet">{m.products.stepper.step1.measurementsTitle}</p>
            <MeasurementsField
              clothingType={clothingType}
              values={measurements}
              onChange={setMeasurements}
            />
          </div>
        </CardContent>
      </Card>

      <AiImageSection
        product={product}
        shopAiImageEnabled={shopAiImageEnabled}
        aiModels={aiModels}
        referenceImage={aiReferenceImage}
        generatedImage={aiGeneratedImage}
        clothingType={clothingType}
        r2BaseUrl={r2BaseUrl}
        // Stepper auto-enqueues placement on Next; a manual button
        // here would only invite duplicate calls.
        showGenerateControls={false}
        onAiRequiredStateChange={handleAiRequiredStateChange}
      />

      <Card>
        <CardHeader>
          <CardTitle>{m.products.stepper.step1.mediaTitle}</CardTitle>
          <CardDescription>
            {m.products.stepper.step1.mediaDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <MediaUploader productId={product.id} />
          <section className="space-y-3">
            <h3 className="text-caplet">
              {m.products.detail.photosTitle}
              {imageItems.length > 0 ? ` · ${imageItems.length}` : ""}
            </h3>
            <ImageList images={imageItems} />
          </section>
          <section className="space-y-3">
            <h3 className="text-caplet">
              {m.products.detail.videosTitle}
              {videoItems.length > 0 ? ` · ${videoItems.length}` : ""}
            </h3>
            <VideoList videos={videoItems} />
          </section>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!canProceed && (
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.step1.nextDisabledReason(
              missingFieldList({
                clothingType,
                condition,
                basePriceCents,
                hasImage,
                aiImageOn,
                aiModelId,
                aiSourcePanel,
                aiHasReference,
              }),
            )}
          </p>
        )}
        <Button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || submitting}
        >
          {m.products.stepper.next}
        </Button>
      </div>
    </div>
  );
}

function missingFieldList(s: {
  clothingType: ClothingType | null;
  condition: ProductCondition | null;
  basePriceCents: number | null;
  hasImage: boolean;
  aiImageOn: boolean;
  aiModelId: string | null;
  aiSourcePanel: PanelKey | null;
  aiHasReference: boolean;
}): string {
  const labels: string[] = [];
  if (!s.clothingType) labels.push(m.products.form.clothingType);
  if (!s.condition) labels.push(m.products.form.condition);
  if (s.basePriceCents === null || s.basePriceCents <= 0)
    labels.push(m.products.form.basePrice);
  if (!s.hasImage) labels.push(m.products.stepper.step1.imageRequired);
  if (s.aiImageOn) {
    if (!s.aiModelId) labels.push(m.products.stepper.step1.aiModelRequired);
    if (!s.aiHasReference)
      labels.push(m.products.stepper.step1.aiReferenceRequired);
    if (!s.aiSourcePanel)
      labels.push(m.products.stepper.step1.aiSourcePanelRequired);
  }
  return labels.join(" · ");
}

// Reference STEP_1_REQUIRED to ensure the keep-in-sync intent is
// obvious to a future reader.
void STEP_1_REQUIRED;
