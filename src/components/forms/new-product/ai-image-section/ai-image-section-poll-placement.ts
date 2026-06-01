import type { AiImageStatusResponse } from "@/app/(admin)/products/[id]/ai-image-status/route";

import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from "./ai-image-section.const";
import type { GeneratedAiImage } from "./ai-image-section.types";

/** Poll the placement status route until the run that started AFTER
 *  `startedAt` finishes. Returns the freshly generated image on
 *  success; null on failure or timeout. */
export async function pollPlacementUntilDone(
  productId: string,
  startedAt: number,
): Promise<{ ok: true; image: GeneratedAiImage } | { ok: false }> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`/products/${productId}/ai-image-status`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as AiImageStatusResponse;
      const finishedAt = data.run?.finishedAt
        ? new Date(data.run.finishedAt).getTime()
        : 0;
      // Ignore stale rows that finished before we even kicked the job.
      if (finishedAt < startedAt) continue;
      if (data.run?.status === "succeeded") {
        return { ok: true, image: data.image };
      }
      if (data.run?.status === "failed") return { ok: false };
    } catch {
      // network blip — keep polling
    }
  }
  return { ok: false };
}
