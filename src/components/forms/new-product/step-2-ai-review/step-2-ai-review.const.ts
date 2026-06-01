import type { Product } from "@/lib/db/schema";

import type { useAiStatusPolling } from "@/components/products/use-ai-status-polling";

/** ~2.5 minutes at the 2.5 s polling cadence. */
export const POLL_TIMEOUT_MS = 150_000;

export type Phase = "running" | "succeeded" | "failed";

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
export function derivePhase(
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

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
