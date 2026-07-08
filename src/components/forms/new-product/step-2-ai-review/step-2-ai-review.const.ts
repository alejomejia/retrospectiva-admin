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
    return product.titleEn && product.titleEn.trim() !== ""
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

  // No enrich row. After a kick (handled above) this means the worker
  // hasn't inserted the new row yet → running. Otherwise it's a product
  // that simply never had an enrich run (e.g. an older/edited listing);
  // fall back to the content snapshot like the pre-first-poll branch so
  // we don't pin to "running" and poll `/ai-status` forever.
  if (!enrich) {
    if (kickedAt > 0) return "running"; // new run kicked, row not visible yet
    return product.titleEn && product.titleEn.trim() !== ""
      ? "succeeded"
      : "running";
  }
  if (enrich.status === "succeeded") return "succeeded";
  if (enrich.status === "failed") return "failed";
  return "running";
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
