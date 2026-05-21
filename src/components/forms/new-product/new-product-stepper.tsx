"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Stepper } from "@/components/forms/stepper";
import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { ClothingType, Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";

import {
  type AiReferenceImage,
  type GeneratedAiImage,
} from "./ai-image-section";
import { AutosaveIndicator } from "./autosave-indicator";
import { AutosaveProvider } from "./autosave-context";
import { Step1Inputs } from "./step-1-inputs";
import { Step2AiReview } from "./step-2-ai-review";
import { Step3Summary } from "./step-3-summary";
import { Step4Publish } from "./step-4-publish";

type StepKey = "inputs" | "ai" | "summary" | "publish";

const STEP_ORDER: StepKey[] = ["inputs", "ai", "summary", "publish"];

function parseStep(raw: string | null): StepKey {
  if (raw && (STEP_ORDER as readonly string[]).includes(raw)) {
    return raw as StepKey;
  }
  return "inputs";
}

/**
 * 4-step new-product flow. Step lives in the URL (`?step=…`) so
 * back/forward + refresh work as expected. Per-field autosave from
 * the autosave context keeps the draft DB row in sync; there is no
 * separate "save" between steps.
 *
 * Steps:
 *   1. inputs   — manual fields (price, garment, condition, sizes, measurements, media)
 *   2. ai       — AI review of generated title/description/tags/etc. (Task 6 wires it)
 *   3. summary  — read-only Etsy preview of the assembled listing
 *   4. publish  — Save draft / Schedule / Publish now
 */
export function NewProductStepper({
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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStep = parseStep(searchParams.get("step"));
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const steps = useMemo(
    () => [
      { id: "inputs", label: m.products.stepper.steps.inputs },
      { id: "ai", label: m.products.stepper.steps.aiReview },
      { id: "summary", label: m.products.stepper.steps.summary },
      { id: "publish", label: m.products.stepper.steps.publish },
    ],
    [],
  );

  const go = useCallback(
    (step: StepKey) => {
      const params = new URLSearchParams(searchParams);
      if (step === "inputs") params.delete("step");
      else params.set("step", step);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
    },
    [pathname, router, searchParams],
  );

  return (
    <AutosaveProvider
      productId={product.id}
      initialUpdatedAt={product.updatedAt}
    >
      <div className="space-y-6">
        <Stepper currentStepIndex={currentIndex}>
          <div className="flex justify-between items-center gap-4">
            <Stepper.List>
              {steps.map((step, index) => (
                <Stepper.Item
                  key={step.id}
                  index={index}
                  label={step.label}
                  isLast={index === steps.length - 1}
                />
              ))}
            </Stepper.List>
            <AutosaveIndicator />
          </div>
          {currentStep === "inputs" && (
            <Step1Inputs
              product={product}
              shopMarkupPercent={shopMarkupPercent}
              shopAiImageEnabled={shopAiImageEnabled}
              buyPriceDefaults={buyPriceDefaults}
              imageItems={imageItems}
              videoItems={videoItems}
              aiModels={aiModels}
              aiReferenceImage={aiReferenceImage}
              aiGeneratedImage={aiGeneratedImage}
              r2BaseUrl={r2BaseUrl}
              onNext={() => go("ai")}
            />
          )}
          {currentStep === "ai" && (
            <Step2AiReview
              product={product}
              initialAiImage={aiGeneratedImage}
              onPrev={() => go("inputs")}
              onNext={() => go("summary")}
            />
          )}
          {currentStep === "summary" && (
            <Step3Summary
              product={product}
              shopMarkupPercent={shopMarkupPercent}
              imageItems={imageItems}
              videoItems={videoItems}
              aiGeneratedImage={aiGeneratedImage}
              onPrev={() => go("ai")}
              onNext={() => go("publish")}
            />
          )}
          {currentStep === "publish" && (
            <Step4Publish product={product} onPrev={() => go("summary")} />
          )}
        </Stepper>
      </div>
    </AutosaveProvider>
  );
}
