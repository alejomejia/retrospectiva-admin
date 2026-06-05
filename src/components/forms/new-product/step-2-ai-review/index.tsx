"use client";

import { AiContentSection } from "@/components/products/ai-content-section";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";

import type { GeneratedAiImage } from "../ai-image-section";
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
}: {
  product: Product;
  initialAiImage: GeneratedAiImage;
  shopListingFooterEs: string;
}) {
  const { phase, error, kick, kickPending } = useStep2AiReview({ product });

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
            key={product.updatedAt.getTime()}
            product={product}
            onRegenerate={kick}
            regenerating={kickPending}
          />
        )}
        {phase !== "running" && (
          <ListingFooterField
            key={`footer-${product.updatedAt.getTime()}`}
            productId={product.id}
            shopFooterDefaultEs={shopListingFooterEs}
            initialOverrideEs={product.listingFooterEsOverride}
          />
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
