"use client";

import { MediaUploader } from "@/components/forms/media-uploader";
import { ImageList, type ImageListItem } from "@/components/products/image-list";
import { VideoList, type VideoListItem } from "@/components/products/video-list";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ActiveAiModelListItem } from "@/lib/ai-models/actions";
import type { ClothingType, Product } from "@/lib/db/schema";
import type { ShippingProfile } from "@/lib/integrations/etsy/shop-config";
import { m } from "@/lib/i18n/messages.es";
import { cn } from "@/lib/utils/helpers";
import { Star } from "lucide-react";

import {
  AiImageSection,
  type AiReferenceImage,
  type GeneratedAiImage,
} from "../ai-image-section";
import { AiImageOverrideField } from "../ai-image-override-field";
import { BuyPriceField } from "../buy-price-field";
import { ConditionField } from "../condition-field";
import { GarmentTypeField } from "../garment-type-field";
import { MeasurementsField } from "../measurements-field";
import { PriceField } from "../price-field";
import { SizeField } from "../sizes-field";
import { useStep1Inputs } from "./use-step-1-inputs";

export { missingFieldList } from "./step-1-inputs.const";

/**
 * Step 1 — user inputs. Owns local state for instant UI feedback;
 * the autosave context persists each change in the background.
 */
export function Step1Inputs({
  product,
  featuredSlotsFull,
  shopMarkupPercent,
  shopDefaultDiscountPercent,
  shopAiImageEnabled,
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
  /** Shop already holds the max featured products (excl. this one). */
  featuredSlotsFull: boolean;
  shopMarkupPercent: number;
  shopDefaultDiscountPercent: number;
  shopAiImageEnabled: boolean;
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
  const vm = useStep1Inputs({
    product,
    shopAiImageEnabled,
    buyPriceDefaults,
    imageItems,
    aiReferenceImage,
    shippingMapping,
  });

  return (
    <div>
      {/* Product assets */}
      <div className="flex flex-col gap-8 p-6 border-b border-border">
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1">
            <span className="font-mono text-brand-terracotta">01</span>
            <span className="uppercase text-foreground">{m.products.stepper.step1.mediaTitle}</span>
          </h2>
          <p>{m.products.stepper.step1.mediaDescription}</p>
        </header>
        <MediaUploader productId={product.id} />
        <div className="space-y-3">
          <h3 className="text-caplet">
            {m.products.detail.photosTitle}
            {imageItems.length > 0 ? ` · ${imageItems.length}` : ""}
          </h3>
          <ImageList images={imageItems} />
        </div>
        <div className="space-y-3">
          <h3 className="text-caplet">
            {m.products.detail.videosTitle}
            {videoItems.length > 0 ? ` · ${videoItems.length}` : ""}
          </h3>
          <VideoList productId={product.id} videos={videoItems} />
        </div>
      </div>

      {/* Product data */}
      <div className="flex flex-col gap-8 p-6 border-b border-border">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1">
              <span className="font-mono text-brand-terracotta">02</span>
              <span className="uppercase text-foreground">{m.products.stepper.step1.title}</span>
            </h2>
            <p>{m.products.stepper.step1.description}</p>
          </div>
          {featuredSlotsFull && !vm.isFeatured ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Disabled control swallows pointer events, so the
                    wrapper span is what the tooltip listens on. */}
                <span tabIndex={0} className="inline-flex shrink-0">
                  <Star
                    aria-label={m.products.form.featured}
                    className="size-6 text-muted-foreground opacity-40"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {m.products.form.featuredCapTooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => vm.handleFeaturedChange(!vm.isFeatured)}
                  aria-pressed={vm.isFeatured}
                  aria-label={m.products.form.featured}
                  className="shrink-0 rounded-md p-2 transition-colors hover:bg-muted"
                >
                  <Star
                    className={cn(
                      "size-6",
                      vm.isFeatured
                        ? "fill-brand-terracotta text-brand-terracotta"
                        : "text-muted-foreground",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {m.products.form.featuredHint}
              </TooltipContent>
            </Tooltip>
          )}
        </header>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <GarmentTypeField value={vm.clothingType} onChange={vm.handleClothingTypeChange} />
            <ConditionField value={vm.condition} onChange={vm.setCondition} />
            <SizeField value={vm.size} onChange={vm.setSize} />
        </div>
        <MeasurementsField
          clothingType={vm.clothingType}
          values={vm.measurements}
          onChange={vm.setMeasurements}
        />

        <div className="space-y-2">
          <Label htmlFor="comments">
            {m.products.stepper.step1.commentsLabel}
          </Label>
          <Textarea
            id="comments"
            value={vm.comments}
            placeholder={m.products.stepper.step1.commentsPlaceholder}
            rows={3}
            maxLength={1000}
            onChange={(e) => vm.setComments(e.target.value)}
            onBlur={vm.handleCommentsBlur}
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="flex flex-col gap-8 p-6 border-b border-border">
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1">
            <span className="font-mono text-brand-terracotta">03</span>
            <span className="uppercase text-foreground">
              {m.products.stepper.step1.pricingSection.title}
            </span>
          </h2>
          <p>{m.products.stepper.step1.pricingSection.description}</p>
        </header>
        <div className="flex gap-8">
          <PriceField
            basePriceCents={vm.basePriceCents}
            markupPercentOverride={vm.markupOverride}
            shopMarkupPercent={shopMarkupPercent}
            shopDefaultDiscountPercent={shopDefaultDiscountPercent}
            discountPercent={vm.discountPercent}
            currency={product.currency}
            onBaseChange={vm.setBasePriceCents}
            onMarkupChange={vm.setMarkupOverride}
            onDiscountChange={vm.setDiscountPercent}
          />
          <BuyPriceField
            // Remount on clothing-type-driven overwrites so the input
            // reflects the new default; user blur sets state locally.
            key={`buy-${vm.clothingType ?? "none"}`}
            buyPriceCents={vm.buyPriceCents}
            basePriceCents={vm.basePriceCents}
            currency={product.currency}
            onChange={vm.setBuyPriceCents}
          />
        </div>
      </div>

      {/* Shipping profile */}
      <div className="flex flex-col gap-8 p-6 border-b border-border">
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1">
            <span className="font-mono text-brand-terracotta">04</span>
            <span className="uppercase text-foreground">
              {m.products.stepper.step1.shippingSection.title}
            </span>
          </h2>
          <p>{m.products.stepper.step1.shippingSection.description}</p>
        </header>
        {shippingProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {m.products.stepper.step1.shippingSection.emptyBody}
          </p>
        ) : (
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="shipping-profile">
              {m.products.stepper.step1.shippingSection.label}
            </Label>
            <Select
              value={vm.shippingProfileId?.toString() ?? ""}
              onValueChange={(v) =>
                vm.handleShippingProfileChange(v ? Number(v) : null)
              }
            >
              <SelectTrigger id="shipping-profile">
                <SelectValue
                  placeholder={
                    m.products.stepper.step1.shippingSection.placeholder
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {shippingProfiles.map((p) => (
                  <SelectItem
                    key={p.shipping_profile_id}
                    value={p.shipping_profile_id.toString()}
                  >
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* AI product image generation */}
      <div className="flex flex-col gap-8 p-6">
        <header className="flex gap-4 items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1">
              <span className="font-mono text-brand-terracotta">05</span>
              <span className="uppercase text-foreground">{m.products.stepper.step1.aiImageSection.title}</span>
            </h2>
            <p>{m.products.stepper.step1.aiImageSection.description}</p>
          </div>
          <div className="shrink-0">
            <AiImageOverrideField
              value={product.aiImageEnabled}
              shopAiImageEnabled={shopAiImageEnabled}
            />
          </div>
        </header>
        <AiImageSection
          product={product}
          shopAiImageEnabled={shopAiImageEnabled}
          aiModels={aiModels}
          referenceImage={aiReferenceImage}
          generatedImage={aiGeneratedImage}
          clothingType={vm.clothingType}
          r2BaseUrl={r2BaseUrl}
          // Stepper auto-enqueues placement on Next; a manual button
          // here would only invite duplicate calls.
          showGenerateControls={false}
          onAiRequiredStateChange={vm.handleAiRequiredStateChange}
        />
      </div>
    </div>
  );
}
