"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type {
  ClothingType,
  Product,
  ProductCondition,
} from "@/lib/db/schema";
import type { PanelKey } from "@/lib/integrations/openai/panel-keys";
import { m } from "@/lib/i18n/messages.es";
import {
  getRequiredMeasurements,
  getShippingWeightClass,
} from "@/lib/products/clothing-types";
import { enqueueEnrichJob } from "@/lib/products/draft-actions";
import { type SizeValue } from "@/lib/products/draft-schema";
import { generateProductImage } from "@/lib/products/image-placement-actions";
import {
  measurementToColumn,
  type ProductMeasurements,
} from "@/lib/products/measurements";

import type { ImageListItem } from "@/components/products/image-list";

import { useAutosave } from "../autosave";
import type { AiReferenceImage } from "../ai-image-section";
import { useStepFooter } from "../step-footer-context";
import { missingFieldList } from "./step-1-inputs.const";

type Args = {
  product: Product;
  shopAiImageEnabled: boolean;
  buyPriceDefaults: Record<ClothingType, number | null>;
  imageItems: ImageListItem[];
  aiReferenceImage: AiReferenceImage;
  shippingMapping: {
    light: number | null;
    medium: number | null;
    heavy: number | null;
  };
};

export function useStep1Inputs({
  product,
  shopAiImageEnabled,
  buyPriceDefaults,
  imageItems,
  aiReferenceImage,
  shippingMapping,
}: Args) {
  const { schedule, flush } = useAutosave();
  const [submitting, setSubmitting] = useState(false);

  // Local state mirrors the product row; autosave handles persistence.
  // Note: the product title is intentionally not editable here — AI
  // generates it in step 2.
  const [comments, setComments] = useState<string>(product.comments ?? "");
  const [clothingType, setClothingType] = useState<ClothingType | null>(
    product.clothingType,
  );
  const [condition, setCondition] = useState<ProductCondition | null>(
    product.condition,
  );
  const [size, setSize] = useState<SizeValue | null>(
    product.size as SizeValue | null,
  );
  const [isFeatured, setIsFeatured] = useState<boolean>(product.isFeatured);
  const handleFeaturedChange = (next: boolean) => {
    setIsFeatured(next);
    schedule({ isFeatured: next });
  };
  const [basePriceCents, setBasePriceCents] = useState<number | null>(
    product.basePriceCents,
  );
  const [markupOverride, setMarkupOverride] = useState<number | null>(
    product.markupPercentOverride,
  );
  const [discountPercent, setDiscountPercent] = useState<number | null>(
    product.discountPercent,
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
  const [shippingProfileId, setShippingProfileId] = useState<number | null>(
    product.shippingProfileId,
  );
  // Keep local state in sync with autosave-driven server updates. The
  // server resolves the shop-mapping shipping profile on every
  // `clothingType` change, so the row's `shippingProfileId` may shift
  // out from under the form. Refresh from the product prop whenever it
  // changes (the autosave provider revalidates the page on success).
  useEffect(() => {
    setShippingProfileId(product.shippingProfileId);
  }, [product.shippingProfileId]);
  const handleShippingProfileChange = (id: number | null) => {
    setShippingProfileId(id);
    schedule({ shippingProfileId: id });
  };
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
    sleeveWidthCm: product.sleeveWidthCm,
    sleeveLengthCm: product.sleeveLengthCm,
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
    // Auto-pick the shipping profile from the shop-wide weight-class
    // mapping. Mirrors the server-side derivation in
    // `updateProductDraftField` so the UI reflects the choice
    // immediately; the explicit `shippingProfileId` in the patch wins
    // over the server's auto-pick.
    const shipId = shippingMapping[getShippingWeightClass(ct)];
    setShippingProfileId(shipId);
    schedule({ buyPriceCents: def, shippingProfileId: shipId });
  };

  const handleCommentsBlur = () =>
    schedule({ comments: comments.trim() || null });

  const requiredFilled =
    !!clothingType &&
    !!condition &&
    basePriceCents !== null &&
    basePriceCents > 0;
  const hasImage = imageItems.length > 0;
  const measurementsFilled = clothingType
    ? getRequiredMeasurements(clothingType).every((measurement) => {
        if (measurement === "braSize") {
          return measurements.braSize != null && measurements.braSize !== "";
        }
        const col = measurementToColumn(measurement);
        return measurements[col as keyof ProductMeasurements] != null;
      })
    : false;

  // Per-product AI image generation is gated by BOTH the shop-wide
  // toggle (resolved at page load) AND the per-product override —
  // mirrors the server-side gate in `generateProductImage`. Used
  // here to decide whether `handleNext` should fan out to the
  // placement queue alongside the enrichment one.
  const aiImageOn = product.aiImageEnabled ?? shopAiImageEnabled;
  const aiRequiredFilled =
    !aiImageOn || (!!aiModelId && aiHasReference && !!aiSourcePanel);
  const shippingFilled = shippingProfileId !== null;
  const canProceed =
    requiredFilled &&
    hasImage &&
    measurementsFilled &&
    aiRequiredFilled &&
    shippingFilled;
  const canAutoEnqueuePlacement =
    aiImageOn && !!aiModelId && aiHasReference && !!clothingType;

  const { register } = useStepFooter();

  const beforeNext = useCallback(async (): Promise<boolean> => {
    setSubmitting(true);
    const flushed = await flush();
    if (!flushed) {
      setSubmitting(false);
      return false;
    }
    const enqueued = await enqueueEnrichJob(product.id);
    if (!enqueued.ok) {
      setSubmitting(false);
      toast.error(enqueued.error);
      return false;
    }
    if (canAutoEnqueuePlacement) {
      const placement = await generateProductImage(product.id);
      if (!placement.ok) {
        toast.message(placement.error);
      }
    }
    setSubmitting(false);
    return true;
  }, [flush, product.id, canAutoEnqueuePlacement]);

  useEffect(() => {
    register({
      canNext: canProceed && !submitting,
      disabledReason: !canProceed
        ? m.products.stepper.step1.nextDisabledReason(
            missingFieldList({
              clothingType,
              condition,
              basePriceCents,
              hasImage,
              measurementsFilled,
              aiImageOn,
              aiModelId,
              aiSourcePanel,
              aiHasReference,
              shippingFilled,
            }),
          )
        : undefined,
      beforeNext,
    });
  }, [register, canProceed, submitting, beforeNext, clothingType, condition, basePriceCents, hasImage, measurementsFilled, aiImageOn, aiModelId, aiSourcePanel, aiHasReference, shippingFilled]);

  return {
    comments,
    setComments,
    handleCommentsBlur,
    clothingType,
    handleClothingTypeChange,
    condition,
    setCondition,
    size,
    setSize,
    isFeatured,
    handleFeaturedChange,
    basePriceCents,
    setBasePriceCents,
    markupOverride,
    setMarkupOverride,
    discountPercent,
    setDiscountPercent,
    buyPriceCents,
    setBuyPriceCents,
    measurements,
    setMeasurements,
    handleAiRequiredStateChange,
    shippingProfileId,
    handleShippingProfileChange,
  };
}
