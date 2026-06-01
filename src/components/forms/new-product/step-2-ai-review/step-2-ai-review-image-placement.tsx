"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAiImageStatusPolling } from "@/components/products/use-ai-image-status-polling";
import { Button } from "@/components/ui/button";
import { m } from "@/lib/i18n/messages.es";
import { generateProductImage } from "@/lib/products/image-placement-actions";

import type { GeneratedAiImage } from "../ai-image-section";
import { truncate } from "./step-2-ai-review.const";

/**
 * Placement-job status section. Renders only when there's actual
 * activity — running, failed, or a generated image exists. Polls
 * `/ai-image-status` continuously while mounted; cheap (one indexed
 * `ai_runs` lookup + one indexed `product_images` lookup).
 *
 * Step 2 doesn't gate navigation on this: enrichment is the gating
 * signal. Placement just feeds the listing preview.
 */
export function AiImagePlacementSection({
  productId,
  initialImage,
}: {
  productId: string;
  initialImage: GeneratedAiImage;
}) {
  const router = useRouter();
  // Same gating pattern as the enrich poll: stop hammering the
  // endpoint once the placement run reaches a terminal status. Retry
  // re-enables via `pollEnabled` flipping back to true when the new
  // run shows up as running/pending.
  const [pollEnabled, setPollEnabled] = useState(true);
  const status = useAiImageStatusPolling(productId, { enabled: pollEnabled });
  const [retryPending, startRetry] = useTransition();
  const t = m.products.stepper.step2.aiImage;

  const runStatus = status?.run?.status ?? null;
  const finishedAt = status?.run?.finishedAt ?? null;
  useEffect(() => {
    if (runStatus === "succeeded") {
      router.refresh();
    }
    setPollEnabled(
      runStatus === null || runStatus === "running" || runStatus === "pending",
    );
  }, [runStatus, finishedAt, router]);

  const image = status?.image ?? initialImage;

  if (!image && !runStatus) return null;

  const retry = () => {
    startRetry(async () => {
      const result = await generateProductImage(productId, { force: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Re-enable polling: the previous run was terminal so we
      // gated off, but a new run is now enqueued and we need to
      // watch it land.
      setPollEnabled(true);
    });
  };

  return (
    <div
      className="flex flex-col gap-8 p-6"
      aria-live="polite"
    >
      <header className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1">
          <span className="font-mono text-brand-terracotta">02</span>
          <span className="uppercase text-foreground">{t.title}</span>
        </h2>
      </header>
      {runStatus === "running" || runStatus === "pending" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t.running}
        </div>
      ) : null}
      {runStatus === "failed" && (
        <div
          className="flex flex-wrap items-start gap-3 rounded-md border border-brand-terracotta/40 bg-brand-terracotta/5 p-3"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 text-brand-terracotta" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{t.failedTitle}</p>
            {status?.run?.error && (
              <p className="text-xs text-muted-foreground">
                <code className="font-mono">
                  {truncate(status.run.error, 200)}
                </code>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retry}
            disabled={retryPending}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            {t.retry}
          </Button>
        </div>
      )}
      {image && (
        <div className="overflow-hidden rounded-md border bg-muted">
          <Image
            src={image.url}
            alt=""
            width={image.width ?? 400}
            height={image.height ?? 600}
            className="h-auto w-full max-w-xs"
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
