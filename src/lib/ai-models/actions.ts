"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiModels, aiRuns } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import {
  cropPanelsFromSheet,
  PANEL_ORDER,
  type PanelKey,
} from "@/lib/integrations/openai/grid-crop";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { deleteR2Prefix } from "@/lib/integrations/r2/delete-prefix";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { uploadToR2 } from "@/lib/integrations/r2/upload";
import { aiModelGenerateQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import { NewModelSchema, SaveModelSchema, type NewModelInput } from "./schemas";

const PANEL_COLUMN: Record<
  PanelKey,
  | "frontFullKey"
  | "frontPortraitKey"
  | "frontEditorialKey"
  | "sidePortraitKey"
  | "backFullKey"
  | "threequarterFullKey"
> = {
  front_full: "frontFullKey",
  front_portrait: "frontPortraitKey",
  front_editorial: "frontEditorialKey",
  side_portrait: "sidePortraitKey",
  back_full: "backFullKey",
  threequarter_full: "threequarterFullKey",
};

const dev = devGroup("ai-models");

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * Insert a new `ai_models` row with `status='draft'`, then enqueue
 * the BullMQ generation job. Returns the new model ID so the caller
 * can redirect to `/models/[id]` and start polling.
 */
export async function generateModel(
  input: NewModelInput,
): Promise<ActionResult<{ modelId: string }>> {
  await requireSession();
  const parsed = NewModelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: m.errors.invalidForm };
  }
  const data = parsed.data;

  try {
    const [row] = await db
      .insert(aiModels)
      .values({
        status: "draft",
        ageRange: data.ageRange,
        bodyType: data.bodyType,
        heightRange: data.heightRange,
        skinTone: data.skinTone,
        faceShape: data.faceShape,
        hairColor: data.hairColor,
        hairShape: data.hairShape,
        hairType: data.hairType,
      })
      .returning({ id: aiModels.id });
    if (!row) {
      return { ok: false, error: m.errors.couldNotSaveChanges };
    }
    await enqueueGenerationJob(row.id);
    revalidatePath("/models");
    return { ok: true, data: { modelId: row.id } };
  } catch (err) {
    dev.error("generateModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Re-run generation for an existing model. Same dedup pattern as
 * `enqueueEnrichJob`: remove any stale job with the same id before
 * adding a fresh one. Overwrites the existing R2 objects on success
 * because the file names are deterministic per model ID.
 */
export async function regenerateModel(
  id: string,
): Promise<ActionResult> {
  await requireSession();
  try {
    // Clear failed prior runs so polling doesn't see a stale failure.
    await db
      .delete(aiRuns)
      .where(
        and(eq(aiRuns.aiModelId, id), eq(aiRuns.kind, "model_generation"), eq(aiRuns.status, "failed")),
      );
    await enqueueGenerationJob(id);
    revalidatePath(`/models/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("regenerateModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Assign a label and flip `status: draft → active`. The model is now
 * available for per-product selection (Task 11) and shows up in the
 * gallery's default "Activos" tab.
 */
export async function saveModel(
  id: string,
  label: string,
): Promise<ActionResult> {
  await requireSession();
  const parsed = SaveModelSchema.safeParse({ label });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? m.errors.invalidForm,
    };
  }
  try {
    await db
      .update(aiModels)
      .set({
        label: parsed.data.label,
        status: "active",
        updatedAt: sql`now()`,
      })
      .where(eq(aiModels.id, id));
    revalidatePath("/models");
    revalidatePath(`/models/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("saveModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Hard-delete a draft model. Wipes the DB row + its R2 prefix
 * (`assets/models/{id}/`). Only callable on `status='draft'` —
 * active or archived models stay as audit history.
 */
export async function discardModel(
  id: string,
): Promise<ActionResult> {
  await requireSession();
  try {
    const [row] = await db
      .select({ status: aiModels.status })
      .from(aiModels)
      .where(eq(aiModels.id, id))
      .limit(1);
    if (!row) {
      return { ok: false, error: m.models.errors.modelNotFound };
    }
    if (row.status !== "draft") {
      return { ok: false, error: m.models.errors.onlyDraftsCanBeDiscarded };
    }
    // Best-effort R2 cleanup. If it fails, we still drop the DB row
    // — orphan R2 objects can be reaped later via the cleanup queue.
    await deleteR2Prefix({ prefix: `assets/models/${id}/` }).catch(
      (err) => {
        dev.warn("R2 cleanup failed (non-fatal)", id, err);
      },
    );
    await db.delete(aiModels).where(eq(aiModels.id, id));
    revalidatePath("/models");
    return { ok: true };
  } catch (err) {
    dev.error("discardModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/** Move an active model to `archived` — out of rotation but kept. */
export async function archiveModel(id: string): Promise<ActionResult> {
  await requireSession();
  try {
    await db
      .update(aiModels)
      .set({
        status: "archived",
        archivedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(aiModels.id, id));
    revalidatePath("/models");
    revalidatePath(`/models/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("archiveModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/** Move an archived model back to `active`. */
export async function restoreModel(id: string): Promise<ActionResult> {
  await requireSession();
  try {
    await db
      .update(aiModels)
      .set({
        status: "active",
        archivedAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(aiModels.id, id));
    revalidatePath("/models");
    revalidatePath(`/models/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("restoreModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Re-run the crop algorithm against the model's existing contact
 * sheet, without a fresh OpenAI call. Useful when:
 *   - The previous generation produced a valid sheet but cropping
 *     failed (`crops_available=false`).
 *   - The crop algorithm has improved since the original run and
 *     can now succeed on bytes that previously failed.
 *
 * Reuses the sheet's existing run-id prefix in R2 (no orphans
 * created). If cropping still fails on the new pass, the row stays
 * untouched and we return a typed "still no crops" result so the
 * UI can surface that explicitly.
 */
export async function retryCropModel(
  id: string,
): Promise<
  ActionResult<{ cropsAvailable: boolean }>
> {
  await requireSession();
  try {
    const [row] = await db
      .select({
        contactSheetKey: aiModels.contactSheetKey,
      })
      .from(aiModels)
      .where(eq(aiModels.id, id))
      .limit(1);

    if (!row) {
      return { ok: false, error: m.models.errors.modelNotFound };
    }
    if (!row.contactSheetKey) {
      return {
        ok: false,
        error: m.models.errors.noSheetToCrop,
      };
    }

    // Fetch the existing contact sheet via the public URL. Server-
    // side fetch + bytes back; no need for an S3 download helper.
    const sheetUrl = publicUrlFor(row.contactSheetKey, R2_PUBLIC_BASE_URL);
    const res = await fetch(sheetUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `R2 download failed: HTTP ${res.status} ${res.statusText}`,
      );
    }
    const bytes = Buffer.from(await res.arrayBuffer());

    const panels = await cropPanelsFromSheet(bytes);
    if (!panels) {
      // Algorithm still can't carve a 3×2. Leave row untouched.
      return { ok: true, data: { cropsAvailable: false } };
    }

    // Upload panels to the SAME run-id prefix as the existing sheet
    // — the run that produced the sheet is unchanged; we're only
    // adding the panel derivatives.
    const prefix = row.contactSheetKey.replace(/\/contact-sheet\.png$/, "");
    const updates: Partial<typeof aiModels.$inferInsert> = {
      cropsAvailable: true,
      updatedAt: sql`now()` as never,
    };
    for (const panel of PANEL_ORDER) {
      const key = `${prefix}/${panel}.png`;
      await uploadToR2({
        key,
        body: panels[panel],
        contentType: "image/png",
      });
      updates[PANEL_COLUMN[panel]] = key;
    }
    await db.update(aiModels).set(updates).where(eq(aiModels.id, id));

    revalidatePath(`/models/${id}`);
    return { ok: true, data: { cropsAvailable: true } };
  } catch (err) {
    dev.error("retryCropModel error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Shared BullMQ enqueue. Defends against duplicate jobs the same
 * way `enqueueEnrichJob` does — remove first, then add, because the
 * default `.add()` becomes a no-op when a job with the same id
 * already exists (failure-retention window).
 */
async function enqueueGenerationJob(modelId: string): Promise<void> {
  await aiModelGenerateQueue.remove(modelId).catch(() => {
    /* no prior job, or already active — both fine */
  });
  await aiModelGenerateQueue.add(
    "generate",
    { modelId },
    { jobId: modelId },
  );
  dev.log("ai-model-generate enqueued", modelId);
}
