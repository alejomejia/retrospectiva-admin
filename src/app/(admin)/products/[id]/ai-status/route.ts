import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { latestRunForKind } from "@/lib/integrations/openai/ai-runs-log";

/**
 * Status of the AI runs for a product. Polled by step 2 of the
 * new-product stepper every 2 s until the enrich run is done.
 *
 * Shape kept narrow on purpose — the client only needs to know
 * "still running" vs "succeeded" vs "failed" + an error message
 * for the retry banner. Translations are NOT exposed here: they
 * run inline inside the Phase 4c Etsy-publish processor, not on
 * the autosave path, so there's nothing per-field to poll for.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const enrich = await latestRunForKind(id, "enrich");

  return NextResponse.json({
    enrich: enrich
      ? {
          status: enrich.status,
          error: enrich.error,
          finishedAt: enrich.finishedAt?.toISOString() ?? null,
        }
      : null,
  } satisfies AiStatusResponse);
}

export type AiStatusResponse = {
  enrich:
    | {
        status: "pending" | "running" | "succeeded" | "failed";
        error: string | null;
        finishedAt: string | null;
      }
    | null;
};
