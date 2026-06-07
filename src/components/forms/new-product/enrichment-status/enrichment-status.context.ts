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
