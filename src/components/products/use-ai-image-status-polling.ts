"use client";

import { useEffect, useState } from "react";

import type { AiImageStatusResponse } from "@/app/(admin)/products/[id]/ai-image-status/route";

const DEFAULT_INTERVAL_MS = 2500;

/**
 * Polls `GET /products/[id]/ai-image-status` every `intervalMs`
 * (default 2.5 s) and returns the latest payload. Used by step 2 of
 * the new-product stepper to surface placement status alongside the
 * enrichment job (both run in parallel after step 1's Next click).
 *
 * Mirrors `useAiStatusPolling` (enrich); kept as a sibling rather
 * than merged into one fat hook so each surface can be added/removed
 * independently and the response shape is type-safe per route.
 *
 * Network blips are swallowed; loop stops on unmount.
 */
export function useAiImageStatusPolling(
  productId: string,
  options: { intervalMs?: number; enabled?: boolean } = {},
): AiImageStatusResponse | null {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;
  const [status, setStatus] = useState<AiImageStatusResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/products/${productId}/ai-image-status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as AiImageStatusResponse;
        if (!cancelled) setStatus(data);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[ai-image-status] poll error", e);
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
