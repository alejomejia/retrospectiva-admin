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
  // Whether step 2 was entered on a product whose enrich content is
  // already present in the server render. If so, the first succeeded
  // poll is just re-observing content we already have — adopt its
  // `finishedAt` as the baseline without refreshing/remounting.
  const enteredEnriched = useRef(
    Boolean(product.titleEs && product.titleEs.trim() !== ""),
  );
  // Bumped once each post-enrich refresh has actually landed. Drives
  // the `key` on the editable AI-content fields so they remount with
  // the freshly generated values — and ONLY then, never on the
  // unrelated refreshes (autosave, image placement) that also re-fetch
  // the row.
  const [contentVersion, setContentVersion] = useState(0);
  // Set when we kick off a post-enrich `router.refresh()`; cleared once
  // the refreshed `product` prop arrives. The version bump is deferred
  // to that moment because `router.refresh()` is async: bumping the key
  // synchronously here would remount the fields against the STALE
  // (pre-refresh) product and seed them empty, and the later data
  // arrival wouldn't reseed them (same key). See the `product` effect.
  const pendingRefresh = useRef(false);
  useEffect(() => {
    if (enrichStatus !== "succeeded" || !enrichFinishedAt) return;
    if (lastRefreshedFinishedAt.current === enrichFinishedAt) return;
    const isFirstObservation = lastRefreshedFinishedAt.current === null;
    lastRefreshedFinishedAt.current = enrichFinishedAt;
    // Skip the redundant refresh when the first observed run is the one
    // the server already rendered — only a genuinely newer run (a
    // regenerate, or the initial enrich on a fresh draft) should pull
    // fresh content and remount the fields.
    if (isFirstObservation && enteredEnriched.current) return;
    pendingRefresh.current = true;
    router.refresh();
  }, [enrichStatus, enrichFinishedAt, router]);

  // Remount the editable fields only after the refreshed product prop
  // has propagated from the server render. `product` identity changes
  // on every `router.refresh()`, but the `pendingRefresh` gate ensures
  // we bump exclusively for post-enrich refreshes, not autosave/image
  // ones (which also change the prop).
  useEffect(() => {
    if (!pendingRefresh.current) return;
    pendingRefresh.current = false;
    setContentVersion((v) => v + 1);
  }, [product]);

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

  return { phase, error, kick, kickPending, contentVersion };
}
