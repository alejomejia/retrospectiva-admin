"use client";

import { createContext, useContext } from "react";

import type { Phase } from "../step-2-ai-review/step-2-ai-review.const";

export type EnrichmentStatusValue = {
  /** Current enrichment phase, shared across the stepper + sidebar. */
  phase: Phase;
  /** Latest enrichment error (timeout or worker-reported), if any. */
  error: string | null;
  /** Re-enqueue enrichment (Regenerar after success / Retry after failure). */
  kick: () => void;
  /** A kick is in flight. */
  kickPending: boolean;
  /**
   * Monotonic counter bumped only when a NEW enrich pass completes and
   * its fresh AI content is pulled in via `router.refresh()`. Used as
   * the React `key` for the editable AI-content fields so they remount
   * (and re-seed from the new server values) on a real regenerate —
   * but NOT on unrelated refreshes (autosave bumping `updatedAt`, the
   * image-placement job finishing), which would otherwise blur the
   * input the user is typing in.
   */
  contentVersion: number;
};

export const EnrichmentStatusContext =
  createContext<EnrichmentStatusValue | null>(null);

export function useEnrichmentStatusContext(): EnrichmentStatusValue {
  const ctx = useContext(EnrichmentStatusContext);
  if (!ctx) {
    throw new Error(
      "useEnrichmentStatus must be inside EnrichmentStatusProvider",
    );
  }
  return ctx;
}
