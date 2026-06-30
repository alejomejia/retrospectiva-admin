"use client";

import { useEffect, useState } from "react";

import type { VideosStatusResponse } from "@/app/(admin)/products/[id]/videos-status/route";

const DEFAULT_INTERVAL_MS = 2500;

/**
 * Polls `GET /products/[id]/videos-status` every `intervalMs` (default
 * 2.5 s) while `enabled` and returns the latest payload. Used by
 * `VideoList` to watch in-flight transcodes; the caller enables it only
 * while a row is `processing` and disables once everything settles.
 *
 * Mirrors `useAiImageStatusPolling`. Network blips are swallowed; the
 * loop stops on unmount or when disabled.
 */
export function useVideoStatusPolling(
  productId: string,
  options: { intervalMs?: number; enabled?: boolean } = {},
): VideosStatusResponse | null {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;
  const [status, setStatus] = useState<VideosStatusResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/products/${productId}/videos-status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as VideosStatusResponse;
        if (!cancelled) setStatus(data);
      } catch (e) {
        console.warn("[videos-status] poll error", e);
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
