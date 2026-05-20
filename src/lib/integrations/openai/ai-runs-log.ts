import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiRuns, type AiRun } from "@/lib/db/schema";

/**
 * `ai_runs` is the durable audit trail for every OpenAI call. Each
 * processor (enrich, image placement, translate, regenerate) opens a
 * row in `pending` / `running`, then closes it as `succeeded` /
 * `failed` once the API responds. Cost is tracked per call so the
 * Phase 8 dashboard can surface monthly totals without bolting on
 * separate billing instrumentation.
 *
 * Helpers below are kept thin on purpose — processors stay in
 * control of WHAT the input/output shape is; this file just owns
 * the column shape + status transitions.
 */

export type AiRunKind = AiRun["kind"];

export type StartRunInput = {
  /** Product-scoped runs (enrich, translation, model_placement). */
  productId?: string;
  /** Shop-wide runs (model_generation in the Model Studio). */
  aiModelId?: string;
  kind: AiRunKind;
  model?: string | null;
  input?: unknown;
};

export type CompleteRunInput = {
  id: string;
  output?: unknown;
  /** USD cost as a string with up to 6 decimals. */
  costUsd?: string | null;
};

export type FailRunInput = {
  id: string;
  error: string;
  output?: unknown;
};

/**
 * Inserts a fresh `ai_runs` row with `status='running'` and returns
 * its `id`. Call once at the top of each processor; pair with
 * `completeRun` or `failRun`.
 */
export async function startRun(input: StartRunInput): Promise<string> {
  if (!input.productId && !input.aiModelId) {
    throw new Error(
      "startRun: must specify either productId or aiModelId",
    );
  }
  const [row] = await db
    .insert(aiRuns)
    .values({
      productId: input.productId ?? null,
      aiModelId: input.aiModelId ?? null,
      kind: input.kind,
      status: "running",
      model: input.model ?? null,
      inputJson: (input.input as Record<string, unknown> | undefined) ?? null,
    })
    .returning({ id: aiRuns.id });
  if (!row) {
    throw new Error("startRun: insert returned no row");
  }
  return row.id;
}

export async function completeRun(input: CompleteRunInput): Promise<void> {
  await db
    .update(aiRuns)
    .set({
      status: "succeeded",
      outputJson:
        (input.output as Record<string, unknown> | undefined) ?? null,
      costUsd: input.costUsd ?? null,
      finishedAt: sql`now()`,
    })
    .where(eq(aiRuns.id, input.id));
}

export async function failRun(input: FailRunInput): Promise<void> {
  await db
    .update(aiRuns)
    .set({
      status: "failed",
      outputJson:
        (input.output as Record<string, unknown> | undefined) ?? null,
      error: input.error,
      finishedAt: sql`now()`,
    })
    .where(eq(aiRuns.id, input.id));
}

/**
 * Latest run of `kind` for `productId`, or `null`. Used by the
 * polling endpoint to surface "still running / finished / failed".
 */
export async function latestRunForKind(
  productId: string,
  kind: AiRunKind,
): Promise<AiRun | null> {
  const rows = await db
    .select()
    .from(aiRuns)
    .where(eq(aiRuns.productId, productId))
    .orderBy(sql`${aiRuns.createdAt} DESC`)
    .limit(20);
  for (const row of rows) {
    if (row.kind === kind) return row;
  }
  return null;
}
