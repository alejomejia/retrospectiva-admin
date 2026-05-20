"use client";

import { useEffect, useState } from "react";

import type { GenerationStatusResponse } from "@/app/(admin)/models/[id]/generation-status/route";

const POLL_INTERVAL_MS = 2500;

/**
 * Polls `/models/[id]/generation-status` every 2.5 s and returns
 * the latest payload. Stops polling once the run is `succeeded` or
 * `failed` to save round-trips (generations take ~30-60s, so the
 * loop stops as soon as we hit a terminal state).
 *
 * Network blips are swallowed; the next tick retries.
 */
export function useModelGenerationStatus(
  modelId: string,
): GenerationStatusResponse | null {
  const [status, setStatus] = useState<GenerationStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/models/${modelId}/generation-status`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as GenerationStatusResponse;
        if (cancelled) return;
        setStatus(data);

        // Stop polling once we've reached a terminal state.
        const runStatus = data.run?.status;
        if (runStatus === "succeeded" || runStatus === "failed") return;
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[model-generation-status] poll error", e);
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [modelId]);

  return status;
}
