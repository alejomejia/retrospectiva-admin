"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAiStatusPolling } from "@/components/products/use-ai-status-polling";
import type { Product } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { enqueueEnrichJob } from "@/lib/products/draft-actions";

import {
  POLL_TIMEOUT_MS,
  derivePhase,
  type Phase,
} from "../step-2-ai-review/step-2-ai-review.const";
import type { EnrichmentStatusValue } from "./enrichment-status.context";

/**
 * Owns enrichment polling for the whole stepper. Lifted out of step 2
 * so the publish sidebar (rendered on every step) can disable Publish
 * while enrichment is still running, not just while step 2 is mounted.
 */
export function useEnrichmentStatus({
  product,
}: {
  product: Product;
}): EnrichmentStatusValue {
  const router = useRouter();
  const [kickPending, startKickTransition] = useTransition();
  // Server timestamp at which the user last kicked off a fresh run
  // (retry after failure or explicit Regenerar). Used by derivePhase
  // to ignore the pre-kick `finishedAt` so the UI flips back to
  // "running" immediately on click, even before the new ai_runs row
  // is visible in polling.
  const [kickedAt, setKickedAt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // Gate polling on the current phase. Without this the hook would
  // hit `/ai-status` every 2.5s forever even on a completed enrich
  // (visible as a constant request stream in the Next dev console).
  // `kick()` bumps `kickedAt`, which flips phase back to "running"
  // and re-enables polling for the new run.
  const [pollEnabled, setPollEnabled] = useState(true);
  const aiStatus = useAiStatusPolling(product.id, { enabled: pollEnabled });
  const phase: Phase = derivePhase(product, aiStatus, timedOut, kickedAt);
  useEffect(() => {
    setPollEnabled(phase === "running");
  }, [phase]);

  // router.refresh whenever a succeeded enrich row appears that we
  // haven't refreshed for yet. Tracking by `finishedAt` (not just
  // `status`) is what makes Regenerar work: after a regenerate the
  // first poll still shows the PRIOR succeeded row, so a status-only
  // dependency would never re-fire when the worker writes the new
  // row (status stays "succeeded", only `finishedAt` advances).
  const enrichStatus = aiStatus?.enrich?.status ?? null;
  const enrichFinishedAt = aiStatus?.enrich?.finishedAt ?? null;
  const lastRefreshedFinishedAt = useRef<string | null>(null);
  useEffect(() => {
    if (enrichStatus !== "succeeded" || !enrichFinishedAt) return;
    if (lastRefreshedFinishedAt.current === enrichFinishedAt) return;
    lastRefreshedFinishedAt.current = enrichFinishedAt;
    router.refresh();
  }, [enrichStatus, enrichFinishedAt, router]);

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

  return { phase, error, kick, kickPending };
}
