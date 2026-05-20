import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiModels, aiRuns } from "@/lib/db/schema";

/**
 * Status of the ai-model-generate run for a given model row. Polled
 * by `/models/[id]` every 2.5 s while the row hasn't yet received
 * its `contact_sheet_key`.
 *
 * Response is intentionally narrow — the UI only needs to know
 * which of {pending, running, succeeded, failed} the latest run is
 * in, plus the row's `contact_sheet_key` so it can render the
 * preview as soon as it lands.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const [row, latest] = await Promise.all([
    db
      .select({
        contactSheetKey: aiModels.contactSheetKey,
        cropsAvailable: aiModels.cropsAvailable,
        status: aiModels.status,
      })
      .from(aiModels)
      .where(eq(aiModels.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    latestModelGenerationRun(id),
  ]);

  return NextResponse.json({
    model: row
      ? {
          status: row.status,
          contactSheetKey: row.contactSheetKey,
          cropsAvailable: row.cropsAvailable,
        }
      : null,
    run: latest
      ? {
          status: latest.status,
          error: latest.error,
          finishedAt: latest.finishedAt?.toISOString() ?? null,
        }
      : null,
  } satisfies GenerationStatusResponse);
}

/**
 * Latest `kind='model_generation'` run for the model. `ai-runs-log`
 * exposes `latestRunForKind(productId, …)` for product-scoped runs;
 * model-generation runs are keyed on `aiModelId` so we query
 * directly here.
 */
async function latestModelGenerationRun(modelId: string) {
  const rows = await db
    .select()
    .from(aiRuns)
    .where(
      and(
        eq(aiRuns.aiModelId, modelId),
        eq(aiRuns.kind, "model_generation"),
      ),
    )
    .orderBy(sql`${aiRuns.createdAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

export type GenerationStatusResponse = {
  model:
    | {
        status: "draft" | "active" | "archived";
        contactSheetKey: string | null;
        cropsAvailable: boolean;
      }
    | null;
  run:
    | {
        status: "pending" | "running" | "succeeded" | "failed";
        error: string | null;
        finishedAt: string | null;
      }
    | null;
};
