"use client";

import { AiContentSection } from "@/components/products/ai-content-section";
import type { ImageListItem } from "@/components/products/image-list";
import { InstagramStoryDialog } from "@/components/products/instagram-story-dialog";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { variantsForStatus } from "@/lib/products/instagram-story-variants";

import type { GeneratedAiImage } from "../ai-image-section";
import { FeatureImage } from "./step-2-ai-review-feature-image";
import { ListingFooterField } from "./step-2-ai-review-footer";
import { AiImagePlacementSection } from "./step-2-ai-review-image-placement";
import { FailureBanner } from "./step-2-ai-review-failure-banner";
import { RunningSkeleton } from "./step-2-ai-review-running-skeleton";
import { useStep2AiReview } from "./use-step-2-ai-review";

/**
 * Real Step 2. While the `ai-enrich` job runs, shows skeletons +
 * polls the status endpoint. Once it succeeds, the page refreshes
 * so the server-rendered product has the new title/description/etc.
 * + the embedded `AiContentSection` (the same editable surface used
 * by the flat edit form) renders for manual tweaks.
 *
 * Failure path: status banner + retry button that re-enqueues.
 */
export function Step2AiReview({
  product,
  initialAiImage,
  shopListingFooterEs,
  featureImage,
  images,
}: {
  product: Product;
  initialAiImage: GeneratedAiImage;
  shopListingFooterEs: string;
  /** Primary product photo (first in the ordered list), for side-by-side
   *  comparison against the AI-generated copy. Null when no photos. */
  featureImage: ImageListItem | null;
  /** All original product photos, for the Instagram-story picker. */
  images: ImageListItem[];
}) {
  const { phase, error, kick, kickPending, contentVersion } =
    useStep2AiReview();

  return (
    <div>
      {/* AI content review */}
      <div className="flex flex-col gap-8 p-6 border-b border-border">
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1">
            <span className="font-mono text-brand-terracotta">01</span>
            <span className="uppercase text-foreground">
              {m.products.stepper.step2.title}
            </span>
          </h2>
          <p>{m.products.stepper.step2.description}</p>
        </header>
        <FeatureImage image={featureImage} />
        {product.comments && (
          <div className="flex flex-col gap-2">
            <span className="text-caplet text-muted-foreground">
              {m.products.stepper.step1.commentsLabel}
            </span>
            <p className="max-w-prose whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {product.comments}
            </p>
          </div>
        )}
        {phase === "running" && <RunningSkeleton />}
        {phase === "failed" && (
          <FailureBanner
            error={error}
            onRetry={kick}
            retryPending={kickPending}
          />
        )}
        {phase !== "running" && (
          <AiContentSection
            key={`content-${contentVersion}`}
            product={product}
            onRegenerate={kick}
            regenerating={kickPending}
          />
        )}
        {phase !== "running" && (
          <ListingFooterField
            key={`footer-${product.id}`}
            productId={product.id}
            shopFooterDefaultEs={shopListingFooterEs}
            initialOverrideEs={product.listingFooterEsOverride}
          />
        )}
        {phase !== "running" && (
          <div className="flex">
            <InstagramStoryDialog
              productId={product.id}
              images={images}
              variants={variantsForStatus(product.status).map((v) => v.key)}
            />
          </div>
        )}
      </div>

      {/* AI image placement */}
      <AiImagePlacementSection
        productId={product.id}
        initialImage={initialAiImage}
      />
    </div>
  );
}
