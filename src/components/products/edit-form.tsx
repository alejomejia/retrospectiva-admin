"use client";

import { Archive, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MediaUploader } from "@/components/forms/media-uploader";
import { AiImageOverrideField } from "@/components/forms/new-product/ai-image-override-field";
import { AutosaveIndicator } from "@/components/forms/new-product/autosave-indicator";
import { AutosaveProvider } from "@/components/forms/new-product/autosave-context";
import { ConditionField } from "@/components/forms/new-product/condition-field";
import { GarmentTypeField } from "@/components/forms/new-product/garment-type-field";
import { MeasurementsField } from "@/components/forms/new-product/measurements-field";
import { BuyPriceField } from "@/components/forms/new-product/buy-price-field";
import { PriceField } from "@/components/forms/new-product/price-field";
import { SizesField } from "@/components/forms/new-product/sizes-field";
import {
  ImageList,
  type ImageListItem,
} from "@/components/products/image-list";
import {
  VideoList,
  type VideoListItem,
} from "@/components/products/video-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ClothingType,
  Product,
  ProductCondition,
} from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  archiveProduct,
  cancelSchedule,
  enqueueEnrichJob,
  restoreToDraft,
} from "@/lib/products/draft-actions";
import { type SizeValue } from "@/lib/products/draft-schema";
import type { ProductMeasurements } from "@/lib/products/measurements";

import type { AiStatusResponse } from "@/app/(admin)/products/[id]/ai-status/route";

import { AiContentSection } from "./edit-form/ai-content-section";

/** Polling cadence + ceiling for the on-click regenerate flow on
 *  the edit form. Step 2 uses the continuous `useAiStatusPolling`
 *  hook; the edit form polls only after the user clicks Regenerar,
 *  then stops. */
const REGENERATE_POLL_INTERVAL_MS = 2500;
const REGENERATE_POLL_MAX_ATTEMPTS = 60; // ~2.5 minutes

const STATUS_BADGE_VARIANT: Record<
  Product["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  scheduled: "secondary",
  published: "default",
  sold: "secondary",
  archived: "outline",
};

/**
 * Flat single-page edit form. Used by `/products/[id]` whenever the
 * product is NOT a fresh draft (drafts get the stepper instead).
 *
 * Wraps every field with the same autosave context the stepper uses,
 * so identity / pricing / measurements / AI content all persist per
 * keystroke (debounced 500 ms).
 */
export function ProductEditForm({
  product,
  shopMarkupPercent,
  shopAiImageEnabled,
  imageItems,
  videoItems,
}: {
  product: Product;
  shopMarkupPercent: number;
  shopAiImageEnabled: boolean;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
}) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = () => {
    if (regenerating) return;
    if (!window.confirm(m.products.editForm.aiContent.regenerateConfirm)) {
      return;
    }
    setRegenerating(true);
    void (async () => {
      try {
        const enqueued = await enqueueEnrichJob(product.id, { force: true });
        if (!enqueued.ok) {
          toast.error(enqueued.error);
          return;
        }
        toast.message(m.products.editForm.aiContent.regenerateStartedToast);
        const ok = await pollEnrichUntilDone(product.id);
        if (!ok) {
          toast.error(m.products.editForm.aiContent.regenerateFailed);
          return;
        }
        // Pulls the row with the new AI fields + bumped updatedAt so
        // the AiContentSection's `key` flips and it remounts fresh.
        router.refresh();
      } finally {
        setRegenerating(false);
      }
    })();
  };

  return (
    <AutosaveProvider
      productId={product.id}
      initialUpdatedAt={product.updatedAt}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <AutosaveIndicator />
        </div>

        <IdentitySection
          product={product}
          shopMarkupPercent={shopMarkupPercent}
        />

        {/* Key on updatedAt so the section remounts when an enrichment
            (or any external write) lands fresh data — child editors
            use useState(initialFromProp) and won't pick up new initials
            on re-render alone. */}
        <AiContentSection
          key={product.updatedAt.getTime()}
          product={product}
          onRegenerate={handleRegenerate}
          regenerating={regenerating}
        />

        <MediaSection
          productId={product.id}
          imageItems={imageItems}
          videoItems={videoItems}
        />

        <AiImageSection
          aiImageEnabled={product.aiImageEnabled}
          shopAiImageEnabled={shopAiImageEnabled}
        />

        <EtsySection product={product} />
      </div>
    </AutosaveProvider>
  );
}

function IdentitySection({
  product,
  shopMarkupPercent,
}: {
  product: Product;
  shopMarkupPercent: number;
}) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.products.editForm.identity.title}</CardTitle>
        <CardDescription>
          {m.products.editForm.identity.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <GarmentTypeField value={clothingType} onChange={setClothingType} />
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
          buyPriceCents={buyPriceCents}
          basePriceCents={basePriceCents}
          currency={product.currency}
          onChange={setBuyPriceCents}
        />
        <div className="space-y-2">
          <p className="text-caplet">
            {m.products.editForm.identity.measurementsLabel}
          </p>
          <MeasurementsField
            clothingType={clothingType}
            values={measurements}
            onChange={setMeasurements}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MediaSection({
  productId,
  imageItems,
  videoItems,
}: {
  productId: string;
  imageItems: ImageListItem[];
  videoItems: VideoListItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.products.detail.mediaTitle}</CardTitle>
        <CardDescription>
          {m.products.detail.mediaDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <MediaUploader productId={productId} />
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
  );
}

function AiImageSection({
  aiImageEnabled,
  shopAiImageEnabled,
}: {
  aiImageEnabled: boolean | null;
  shopAiImageEnabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.products.editForm.aiImage.title}</CardTitle>
        <CardDescription>
          {m.products.editForm.aiImage.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AiImageOverrideField
          value={aiImageEnabled}
          shopAiImageEnabled={shopAiImageEnabled}
        />
      </CardContent>
    </Card>
  );
}

function EtsySection({ product }: { product: Product }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handle = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    onOk: () => string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(onOk());
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.products.editForm.etsy.title}</CardTitle>
        <CardDescription>
          {m.products.editForm.etsy.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={m.products.editForm.etsy.statusLabel}
            value={
              <Badge variant={STATUS_BADGE_VARIANT[product.status]}>
                {m.products.statuses[product.status]}
              </Badge>
            }
          />
          <Field
            label={m.products.editForm.etsy.listingIdLabel}
            value={
              product.etsyListingId !== null ? (
                <span className="font-mono text-sm">
                  {product.etsyListingId}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {m.products.editForm.etsy.notPublishedYet}
                </span>
              )
            }
          />
          {product.scheduledPublishAt && (
            <Field
              label={m.products.editForm.etsy.scheduledForLabel}
              value={
                <span className="text-sm">
                  {product.scheduledPublishAt.toLocaleString("es-ES", {
                    timeZone: "Europe/Madrid",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              }
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {product.status === "scheduled" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                handle(
                  () => cancelSchedule(product.id),
                  () => m.products.editForm.etsy.scheduleCancelledToast,
                )
              }
            >
              <XCircle className="size-4" />
              {m.products.editForm.etsy.cancelSchedule}
            </Button>
          )}
          {(product.status === "published" ||
            product.status === "scheduled" ||
            product.status === "sold") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                handle(
                  () => archiveProduct(product.id),
                  () => m.products.editForm.etsy.archivedToast,
                )
              }
            >
              <Archive className="size-4" />
              {m.products.editForm.etsy.archive}
            </Button>
          )}
          {(product.status === "archived" ||
            product.status === "sold") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                handle(
                  () => restoreToDraft(product.id),
                  () => m.products.editForm.etsy.restoredToast,
                )
              }
            >
              <RotateCcw className="size-4" />
              {m.products.editForm.etsy.restoreToDraft}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-caplet">{label}</p>
      <div>{value}</div>
    </div>
  );
}

/**
 * One-shot polling for the on-click Regenerar flow. Returns true on
 * the first poll whose `enrich.finishedAt` is newer than `startedAt`
 * AND status is `succeeded`; returns false on `failed` or after the
 * attempt ceiling. The wider continuous-polling pattern lives in
 * `useAiStatusPolling` and is only used by step 2 of the stepper.
 */
async function pollEnrichUntilDone(productId: string): Promise<boolean> {
  const startedAt = Date.now();
  for (let i = 0; i < REGENERATE_POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, REGENERATE_POLL_INTERVAL_MS));
    try {
      const res = await fetch(`/products/${productId}/ai-status`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as AiStatusResponse;
      const finishedAt = data.enrich?.finishedAt
        ? new Date(data.enrich.finishedAt).getTime()
        : 0;
      if (finishedAt < startedAt) continue; // pre-kick row
      if (data.enrich?.status === "succeeded") return true;
      if (data.enrich?.status === "failed") return false;
    } catch {
      // network blip — keep trying
    }
  }
  return false;
}
