"use client";

import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { AiContentSection } from "@/components/products/edit-form/ai-content-section";
import { useAiStatusPolling } from "@/components/products/use-ai-status-polling";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { enqueueEnrichJob } from "@/lib/products/draft-actions";

/** ~2.5 minutes at the 2.5 s polling cadence. */
const POLL_TIMEOUT_MS = 150_000;

type Phase = "running" | "succeeded" | "failed";

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
  onPrev,
  onNext,
}: {
  product: Product;
  onPrev: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const [kickPending, startKickTransition] = useTransition();
  // Server timestamp at which the user last kicked off a fresh run
  // (retry after failure or explicit Regenerar). Used by derivePhase
  // to ignore the pre-kick `finishedAt` so the UI flips back to
  // "running" immediately on click, even before the new ai_runs row
  // is visible in polling.
  const [kickedAt, setKickedAt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const aiStatus = useAiStatusPolling(product.id);

  // Phase is fully derived — no setState-inside-effect. While polling
  // hasn't returned yet, fall back to inspecting the prop snapshot so
  // a re-entry to step 2 (after a prior succeeded run) doesn't briefly
  // flash the skeleton.
  const phase: Phase = derivePhase(product, aiStatus, timedOut, kickedAt);

  // One-shot router.refresh on transition to succeeded so the
  // AiContentSection re-mounts with the AI-filled fields.
  const enrichStatus = aiStatus?.enrich?.status ?? null;
  useEffect(() => {
    if (enrichStatus === "succeeded") {
      router.refresh();
    }
  }, [enrichStatus, router]);

  // Wall-clock timeout: if we stay in "running" too long, flip to
  // "failed" so the user gets a retry banner rather than an infinite
  // spinner. Resets on every kick via the dependency on kickedAt.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setTimeout(() => setTimedOut(true), POLL_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase, kickedAt]);

  const error = timedOut
    ? m.products.stepper.step2.timeoutError
    : (aiStatus?.enrich?.error ?? null);

  // Used by both Regenerar (after success) and Retry (after failure).
  // `force: true` bypasses the server-side skip-if-succeeded check.
  const kick = () => {
    startKickTransition(async () => {
      const result = await enqueueEnrichJob(product.id, { force: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTimedOut(false);
      setKickedAt(Date.now());
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand-terracotta" />
          {m.products.stepper.step2.title}
        </CardTitle>
        <CardDescription>
          {m.products.stepper.step2.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {phase === "running" && <RunningSkeleton />}
        {phase === "failed" && (
          <FailureBanner
            error={error}
            onRetry={kick}
            retryPending={kickPending}
          />
        )}
        {phase !== "running" && (
          // Key on updatedAt so the section remounts when AI completes
          // + router.refresh() pulls fresh data. Otherwise the child
          // editors keep their first-mount `useState(initial)` values
          // and look empty even when product.titleEs is set.
          <AiContentSection
            key={product.updatedAt.getTime()}
            product={product}
            onRegenerate={kick}
            regenerating={kickPending}
          />
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onPrev}>
            {m.products.stepper.prev}
          </Button>
          <Button
            type="button"
            onClick={onNext}
            disabled={phase === "running"}
          >
            {m.products.stepper.next}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compute the visible phase from polling state.
 *
 * - `timedOut` short-circuits to `failed` so the UI doesn't sit on a
 *   spinner forever.
 * - `kickedAt` is the client-clock millis at which the user clicked
 *   Regenerar or Retry. If polling still shows a `finishedAt` older
 *   than that, the latest run is pre-kick and we treat the UI as
 *   still running until the worker inserts the new row. Same idea
 *   works for both retry (latest was failed) and regenerate (latest
 *   was succeeded) — one mechanism, two entry points.
 * - Before the first poll, fall back to the prop snapshot so a
 *   re-entry into step 2 after a prior successful run doesn't briefly
 *   flash the skeleton.
 */
function derivePhase(
  product: Product,
  aiStatus: ReturnType<typeof useAiStatusPolling>,
  timedOut: boolean,
  kickedAt: number,
): Phase {
  if (timedOut) return "failed";

  if (!aiStatus) {
    return product.titleEs && product.titleEs.trim() !== ""
      ? "succeeded"
      : "running";
  }

  const enrich = aiStatus.enrich;
  // If the latest run finished BEFORE the user kicked off a new one,
  // treat as running — the worker hasn't recorded the new row yet.
  if (
    kickedAt > 0 &&
    enrich?.finishedAt &&
    new Date(enrich.finishedAt).getTime() < kickedAt
  ) {
    return "running";
  }

  if (!enrich) return "running"; // no row yet (e.g. just-deleted on retry)
  if (enrich.status === "succeeded") return "succeeded";
  if (enrich.status === "failed") return "failed";
  return "running";
}

function RunningSkeleton() {
  return (
    <div
      className="space-y-4 rounded-md border border-dashed border-border bg-muted/30 p-4"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {m.products.stepper.step2.runningLabel}
      </div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function FailureBanner({
  error,
  onRetry,
  retryPending,
}: {
  error: string | null;
  onRetry: () => void;
  retryPending: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-md border border-brand-terracotta/40 bg-brand-terracotta/5 p-4"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-5 text-brand-terracotta" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">
          {m.products.stepper.step2.failedTitle}
        </p>
        <p className="text-sm text-muted-foreground">
          {m.products.stepper.step2.failedBody}
        </p>
        {error && (
          <p className="text-xs text-muted-foreground" title={error}>
            <code className="font-mono">{truncate(error, 200)}</code>
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retryPending}
        className="gap-1.5"
      >
        <RefreshCw className="size-3.5" />
        {m.products.stepper.step2.retry}
      </Button>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
