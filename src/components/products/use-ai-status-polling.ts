"use client";

import { useEffect, useState } from "react";

import type { AiStatusResponse } from "@/app/(admin)/products/[id]/ai-status/route";

const DEFAULT_INTERVAL_MS = 2500;

/**
 * Polls `GET /products/[id]/ai-status` every `intervalMs` (default
 * 2.5 s) and returns the latest payload. Used by both step 2 of the
 * new-product stepper and the flat edit form to surface enrichment
 * status + per-field "Actualizando…" translation badges.
 *
 * Network blips don't break the loop — failures are swallowed and
 * the next tick retries. The hook stops cleanly when the component
 * unmounts.
 *
 * NOTE: polling runs unconditionally while mounted. Translations are
 * cheap to query (one indexed `ai_runs` SELECT) and the cadence is
 * loose enough (~24 reqs/min) that gating on activity isn't worth
 * the extra coordination with the autosave path.
 */
export function useAiStatusPolling(
  productId: string,
  options: { intervalMs?: number; enabled?: boolean } = {},
): AiStatusResponse | null {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;
  const [status, setStatus] = useState<AiStatusResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/products/${productId}/ai-status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as AiStatusResponse;
        if (!cancelled) setStatus(data);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ai-status] poll error", e);
      }
    };

    void tick();
    const id = setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [productId, intervalMs, enabled]);

  return status;
}
