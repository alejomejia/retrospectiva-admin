"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type {
  ClothingType,
  Product,
  ProductCondition,
} from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import {
  getRequiredMeasurements,
  getShippingWeightClass,
  isMeasurementRequired,
} from "@/lib/products/clothing-types";
import { enqueueEnrichJob } from "@/lib/products/draft-actions";
import { type SizeValue } from "@/lib/products/draft-schema";
import type { ShippingProfile } from "@/lib/integrations/etsy/shop-config";
import {
  measurementToColumn,
  type ProductMeasurements,
} from "@/lib/products/measurements";

import type { ImageListItem } from "@/components/products/image-list";

import { useAutosave } from "../autosave";
import { useStepFooter } from "../step-footer-context";
import { missingFieldList } from "./step-1-inputs.const";

type Args = {
  product: Product;
  buyPriceDefaults: Record<ClothingType, number | null>;
  imageItems: ImageListItem[];
  shippingProfiles: ShippingProfile[];
  shippingMapping: {
    light: number | null;
    medium: number | null;
    heavy: number | null;
  };
};

/**
 * Resolve the shop's "Free Shipping" Etsy profile id from the profile
 * list by title, so new products default to free shipping instead of
 * the weight-class mapping. Returns `null` when no such profile exists,
 * letting callers fall back to the weight-class default.
 */
function findFreeShippingProfileId(
  profiles: ShippingProfile[],
): number | null {
  const free =
    profiles.find((p) => p.title.toLowerCase().includes("free shipping")) ??
    profiles.find((p) => p.title.toLowerCase().includes("free"));
  return free?.shipping_profile_id ?? null;
}

export function useStep1Inputs({
  product,
  buyPriceDefaults,
  imageItems,
  shippingProfiles,
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
  const freeShippingProfileId = findFreeShippingProfileId(shippingProfiles);
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
  // Default a fresh draft to the shop's Free Shipping profile and persist
  // it, so publish has a real profile id even if the operator never opens
  // the picker. Only fires once, when the row has no profile yet — edit
  // mode already carries a saved id, so this is a no-op there.
  useEffect(() => {
    if (product.shippingProfileId === null && freeShippingProfileId !== null) {
      setShippingProfileId(freeShippingProfileId);
      schedule({ shippingProfileId: freeShippingProfileId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleShippingProfileChange = (id: number | null) => {
    setShippingProfileId(id);
    schedule({ shippingProfileId: id });
  };
  const [measurements, setMeasurements] = useState<ProductMeasurements>({
    shoulderCm: product.shoulderCm,
    sleeveWidthCm: product.sleeveWidthCm,
    sleeveLengthCm: product.sleeveLengthCm,
    chestCm: product.chestCm,
    waistCm: product.waistCm,
    waistMaxCm: product.waistMaxCm,
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
    // Default to the shop's Free Shipping profile when one exists,
    // otherwise fall back to the weight-class mapping. Mirrors the
    // server-side derivation in `updateProductDraftField` so the UI
    // reflects the choice immediately; the explicit `shippingProfileId`
    // in the patch wins over the server's auto-pick.
    const shipId =
      freeShippingProfileId ?? shippingMapping[getShippingWeightClass(ct)];
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
    ? getRequiredMeasurements(clothingType)
        .filter(isMeasurementRequired)
        .every((measurement) => {
          if (measurement === "braSize") {
            return measurements.braSize != null && measurements.braSize !== "";
          }
          const col = measurementToColumn(measurement);
          return measurements[col as keyof ProductMeasurements] != null;
        })
    : false;

  const shippingFilled = shippingProfileId !== null;
  const canProceed =
    requiredFilled && hasImage && measurementsFilled && shippingFilled;

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
    setSubmitting(false);
    return true;
  }, [flush, product.id]);

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
              shippingFilled,
            }),
          )
        : undefined,
      beforeNext,
    });
  }, [register, canProceed, submitting, beforeNext, clothingType, condition, basePriceCents, hasImage, measurementsFilled, shippingFilled]);

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
    shippingProfileId,
    handleShippingProfileChange,
  };
}
