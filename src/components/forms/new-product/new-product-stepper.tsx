"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Stepper, type StepperStep } from "@/components/forms/stepper";
import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";

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
  imageItems,
  videoItems,
}: {
  product: Product;
  shopMarkupPercent: number;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStep = parseStep(searchParams.get("step"));
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const steps = useMemo<StepperStep[]>(
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
        <div className="flex justify-end">
          <AutosaveIndicator />
        </div>
        <Stepper steps={steps} currentStepIndex={currentIndex}>
          {currentStep === "inputs" && (
            <Step1Inputs
              product={product}
              shopMarkupPercent={shopMarkupPercent}
              imageItems={imageItems}
              videoItems={videoItems}
              onNext={() => go("ai")}
            />
          )}
          {currentStep === "ai" && (
            <Step2AiReview
              product={product}
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
