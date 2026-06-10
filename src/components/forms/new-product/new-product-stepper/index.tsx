"use client";

import { Stepper } from "@/components/forms/stepper";
import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { ClothingType, Product } from "@/lib/db/schema";
import type { ShippingProfile } from "@/lib/integrations/etsy/shop-config";

import {
  type AiReferenceImage,
  type GeneratedAiImage,
} from "../ai-image-section";
import { AutosaveProvider } from "../autosave";
import { AutosaveIndicator } from "../autosave-indicator";
import { EnrichmentStatusProvider } from "../enrichment-status";
import { PublishSidebar } from "../publish-sidebar";
import type { PublishSidebarMode } from "../publish-sidebar/use-publish-sidebar";
import { Step1Inputs } from "../step-1-inputs";
import { Step2AiReview } from "../step-2-ai-review";
import { StepFooterProvider } from "../step-footer-context";
import { StepperFooter } from "./new-product-stepper-footer";
import { useNewProductStepper } from "./use-new-product-stepper";

/**
 * 2-step new-product flow. Step lives in the URL (`?step=…`) so
 * back/forward + refresh work as expected. Per-field autosave from
 * the autosave context keeps the draft DB row in sync; there is no
 * separate "save" between steps.
 *
 * Steps:
 *   1. inputs   — manual fields (price, garment, condition, sizes, measurements, media)
 *   2. ai       — AI review of generated title/description/tags/etc.
 *
 * The `PublishSidebar` (Save draft / Schedule / Publish now) is the
 * right rail, visible on every step.
 */
export function NewProductStepper({
  product,
  mode = "draft",
  featuredSlotsFull,
  shopMarkupPercent,
  shopAiImageEnabled,
  shopListingFooterEs,
  etsyPoliciesConfigured,
  buyPriceDefaults,
  imageItems,
  videoItems,
  aiModels,
  aiReferenceImage,
  aiGeneratedImage,
  shippingProfiles,
  shippingMapping,
  r2BaseUrl,
}: {
  product: Product;
  mode?: PublishSidebarMode;
  /** Shop already holds the max featured products (excl. this one). */
  featuredSlotsFull: boolean;
  shopMarkupPercent: number;
  shopAiImageEnabled: boolean;
  shopListingFooterEs: string;
  etsyPoliciesConfigured: boolean;
  buyPriceDefaults: Record<ClothingType, number | null>;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
  aiModels: ActiveAiModelListItem[];
  aiReferenceImage: AiReferenceImage;
  aiGeneratedImage: GeneratedAiImage;
  shippingProfiles: ShippingProfile[];
  shippingMapping: {
    light: number | null;
    medium: number | null;
    heavy: number | null;
  };
  r2BaseUrl: string;
}) {
  const vm = useNewProductStepper({ etsyPoliciesConfigured });

  return (
    <AutosaveProvider
      productId={product.id}
      initialUpdatedAt={product.updatedAt}
    >
      <StepFooterProvider>
        <EnrichmentStatusProvider product={product}>
          <Stepper currentStepIndex={vm.currentIndex}>
            <div className="p-6 flex justify-between items-center gap-4 border-b border-border">
              <Stepper.List>
                {vm.steps.map((step, index) => (
                  <Stepper.Item
                    key={step.id}
                    index={index}
                    label={step.label}
                    isLast={index === vm.steps.length - 1}
                  />
                ))}
              </Stepper.List>
              <AutosaveIndicator />
            </div>

            <div className="flex">
              <div>
                {vm.currentStep === "inputs" && (
                  <Step1Inputs
                    product={product}
                    featuredSlotsFull={featuredSlotsFull}
                    shopMarkupPercent={shopMarkupPercent}
                    shopAiImageEnabled={shopAiImageEnabled}
                    buyPriceDefaults={buyPriceDefaults}
                    imageItems={imageItems}
                    videoItems={videoItems}
                    aiModels={aiModels}
                    aiReferenceImage={aiReferenceImage}
                    aiGeneratedImage={aiGeneratedImage}
                    shippingProfiles={shippingProfiles}
                    shippingMapping={shippingMapping}
                    r2BaseUrl={r2BaseUrl}
                  />
                )}
                {vm.currentStep === "ai" && (
                  <Step2AiReview
                    product={product}
                    initialAiImage={aiGeneratedImage}
                    shopListingFooterEs={shopListingFooterEs}
                    featureImage={imageItems[0] ?? null}
                  />
                )}
              </div>
              <div className="border-l border-border w-full max-w-sm bg-card">
                <PublishSidebar
                  product={product}
                  etsyPoliciesConfigured={etsyPoliciesConfigured}
                  mode={mode}
                />
              </div>
            </div>

            <StepperFooter
              prevStep={vm.prevStep}
              nextStep={vm.nextStep}
              nextStepLabel={vm.nextStepLabel}
              onPrev={() => vm.prevStep && vm.go(vm.prevStep)}
              onNext={() => vm.nextStep && vm.go(vm.nextStep)}
            />
          </Stepper>
        </EnrichmentStatusProvider>
      </StepFooterProvider>
    </AutosaveProvider>
  );
}
