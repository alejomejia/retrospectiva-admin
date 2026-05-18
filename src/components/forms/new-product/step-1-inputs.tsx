"use client";

import { useState } from "react";

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
import { STEP_1_REQUIRED, type SizeValue } from "@/lib/products/draft-schema";
import type { ProductMeasurements } from "@/lib/products/measurements";
import { toast } from "sonner";

import { useAutosave } from "./autosave-context";
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
  imageItems,
  videoItems,
  onNext,
}: {
  product: Product;
  shopMarkupPercent: number;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
  onNext: () => void;
}) {
  const { flush } = useAutosave();
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

  const requiredFilled =
    !!clothingType &&
    !!condition &&
    basePriceCents !== null &&
    basePriceCents > 0;
  const hasImage = imageItems.length > 0;
  const canProceed = requiredFilled && hasImage;

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
    setSubmitting(false);
    if (!enqueued.ok) {
      toast.error(enqueued.error);
      return;
    }
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
              onChange={setClothingType}
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
}): string {
  const labels: string[] = [];
  if (!s.clothingType) labels.push(m.products.form.clothingType);
  if (!s.condition) labels.push(m.products.form.condition);
  if (s.basePriceCents === null || s.basePriceCents <= 0)
    labels.push(m.products.form.basePrice);
  if (!s.hasImage) labels.push(m.products.stepper.step1.imageRequired);
  return labels.join(" · ");
}

// Reference STEP_1_REQUIRED to ensure the keep-in-sync intent is
// obvious to a future reader.
void STEP_1_REQUIRED;
