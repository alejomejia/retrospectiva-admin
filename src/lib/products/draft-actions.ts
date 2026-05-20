"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiRuns, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { latestRunForKind } from "@/lib/integrations/openai/ai-runs-log";
import { aiEnrichQueue, etsyPublishQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import { getBuyPriceDefaultForClothingType } from "./buy-price-defaults";
import { getEtsyTaxonomyForClothingType } from "./clothing-types";
import {
  ProductDraftPatchSchema,
  type ProductDraftPatch,
} from "./draft-schema";
import {
  MAX_SCHEDULE_LEAD_MONTHS,
  MIN_SCHEDULE_LEAD_MINUTES,
} from "./schedule-constants";

const dev = devGroup("products.draft");

export type DraftSaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: string };

/**
 * Per-field autosave for the new-product stepper. Accepts a partial
 * patch of `products` columns and persists whichever fields were
 * sent. Does NOT revalidate the page — the client already knows what
 * it sent, and a re-render would invalidate the form.
 *
 * Returns `savedAt` as an ISO string for the "Guardado · hace 2s"
 * indicator.
 */
export async function updateProductDraftField(
  id: string,
  patch: ProductDraftPatch,
): Promise<DraftSaveResult> {
  await requireSession();
  const parsed = ProductDraftPatchSchema.safeParse(patch);
  if (!parsed.success) {
    dev.warn("updateProductDraftField: zod failed", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return { ok: true, savedAt: new Date().toISOString() };
  }

  try {
    const set: Record<string, unknown> = { ...data, updatedAt: sql`now()` };
    // Convert ISO datetime string → Date for the timestamptz column.
    if (typeof data.scheduledPublishAt === "string") {
      set.scheduledPublishAt = new Date(data.scheduledPublishAt);
    }
    // Derive `etsyTaxonomyId` from `clothingType` whenever the patch
    // changes it. The user never picks a taxonomy by hand — the
    // step-1 garment selection IS the taxonomy choice. `0` IDs in
    // the curated list are placeholders pending the live Etsy
    // taxonomy import, so we map them to null to avoid sending bogus
    // IDs to Etsy at publish time.
    if ("clothingType" in data) {
      const ct = data.clothingType;
      if (ct == null) {
        set.etsyTaxonomyId = null;
      } else {
        const taxonomy = getEtsyTaxonomyForClothingType(ct);
        set.etsyTaxonomyId =
          taxonomy && taxonomy.id > 0 ? taxonomy.id : null;
        // Overwrite the per-product buy price with the type's default
        // on every clothing-type change. If the client already sent
        // its own buyPriceCents in the same patch we honor that
        // (explicit user intent wins). Otherwise we resolve the
        // default — null when no default is set for this type, which
        // intentionally clears the column. Changing the default in
        // /settings/products still does NOT touch existing products;
        // this branch only fires when the type itself changes.
        if (set.buyPriceCents === undefined) {
          const def = await getBuyPriceDefaultForClothingType(ct);
          set.buyPriceCents = def;
        }
      }
    }
    const [row] = await db
      .update(products)
      .set(set)
      .where(eq(products.id, id))
      .returning({ updatedAt: products.updatedAt });
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }
    return { ok: true, savedAt: row.updatedAt.toISOString() };
  } catch (err) {
    dev.error("updateProductDraftField DB error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? m.errors.couldNotSaveChangesDetail(err.message)
          : m.errors.couldNotSaveChanges,
    };
  }
}

export type DraftActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save-as-draft terminal action. With per-field autosave already in
 * place, this is essentially a "navigate back" — but we revalidate
 * the list so the new product shows up immediately, and bump
 * `updatedAt`.
 */
export async function saveDraftAndExit(id: string): Promise<DraftActionResult> {
  await requireSession();
  try {
    await db
      .update(products)
      .set({ status: "draft", updatedAt: sql`now()` })
      .where(eq(products.id, id));
    revalidatePath("/products");
    return { ok: true };
  } catch (err) {
    dev.error("saveDraftAndExit DB error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Lifecycle actions for non-draft products on the flat edit form.
 * The real Etsy-side delist / publish wiring lands in Task 9 / Phase
 * 4c; for now these only mutate local state. Each action is small
 * enough that a shared helper would obscure the intent.
 */

export async function archiveProduct(id: string): Promise<DraftActionResult> {
  return setStatus(id, "archived", "product.archived");
}

export async function restoreToDraft(id: string): Promise<DraftActionResult> {
  return setStatus(id, "draft", "product.restoredToDraft");
}

/**
 * Move a product into `status='scheduled'` and persist
 * `scheduled_publish_at`. Re-validates the lead-time caps server
 * side — the picker enforces the same range but a client can always
 * lie, and the BullMQ delayed-job hook (Task 9) will refuse jobs
 * outside this window anyway.
 */
export async function scheduleProduct(
  id: string,
  scheduledIsoUtc: string,
): Promise<DraftActionResult> {
  await requireSession();

  const parsed = z.string().datetime().safeParse(scheduledIsoUtc);
  if (!parsed.success) {
    return {
      ok: false,
      error: m.products.stepper.publish.scheduleTimeInvalid,
    };
  }
  const target = new Date(parsed.data);
  const now = new Date();
  const minTarget = new Date(
    now.getTime() + MIN_SCHEDULE_LEAD_MINUTES * 60_000,
  );
  const maxTarget = new Date(now);
  maxTarget.setMonth(maxTarget.getMonth() + MAX_SCHEDULE_LEAD_MONTHS);

  if (target < minTarget) {
    return {
      ok: false,
      error: m.products.stepper.publish.scheduleTooSoon(
        MIN_SCHEDULE_LEAD_MINUTES,
      ),
    };
  }
  if (target > maxTarget) {
    return {
      ok: false,
      error: m.products.stepper.publish.scheduleTooFar(
        MAX_SCHEDULE_LEAD_MONTHS,
      ),
    };
  }

  try {
    await db
      .update(products)
      .set({
        status: "scheduled",
        scheduledPublishAt: target,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));

    // Enqueue the delayed BullMQ job. `delay` is millis-from-now,
    // BullMQ stores the job in its delayed-set in Redis (so server
    // restarts don't drop the schedule). `remove` first defends
    // against re-scheduling: jobIds are queue-scoped, so a second
    // .add() with the same id would either replace silently or
    // (worse) be ignored depending on the BullMQ version. We
    // swallow remove() errors for the "job is active" race — see
    // `publish-worker.ts` for the race-safety check that handles
    // that path correctly.
    const delayMs = target.getTime() - now.getTime();
    await etsyPublishQueue.remove(id).catch(() => {
      /* no prior job, or already active — both fine */
    });
    await etsyPublishQueue.add(
      "publish",
      { productId: id },
      { jobId: id, delay: delayMs },
    );
    dev.log("etsy-publish scheduled", id, `+${delayMs}ms`);

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("scheduleProduct DB error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

export async function cancelSchedule(id: string): Promise<DraftActionResult> {
  await requireSession();
  try {
    await db
      .update(products)
      .set({
        status: "draft",
        scheduledPublishAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));

    // Drop the pending delayed job. If BullMQ reports "job is active"
    // (the user clicked Cancelar exactly as the delay fired), the
    // worker still runs but its race-safety check sees the new
    // status='draft' and self-cancels — so swallowing the error is
    // correct, not a bug.
    await etsyPublishQueue.remove(id).catch(() => {
      /* no prior job, or already active — both fine */
    });
    dev.log("etsy-publish cancelled", id);

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("cancelSchedule DB error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/**
 * Enqueues the `ai-enrich` job for `productId`. Called from step 1
 * of the new-product stepper when the user clicks "Next" + from the
 * Regenerar button in `AiContentSection`. The job runs in the
 * worker; the client polls `/products/[id]/ai-status` for completion.
 *
 * **Idempotent by default.** If the latest `ai_runs` row of
 * `kind='enrich'` is `succeeded`, this returns `{ok: true}` without
 * enqueueing — re-running would burn another OpenAI call and
 * overwrite any tweaks the user made in step 2. Pass `{force: true}`
 * (from the Regenerar button) to bypass the check and re-enqueue
 * regardless.
 *
 * Re-runs ARE allowed when the latest run is `failed` (recoverable
 * retry, no work to lose) or absent (fresh product).
 */
export async function enqueueEnrichJob(
  productId: string,
  opts: { force?: boolean } = {},
): Promise<DraftActionResult> {
  await requireSession();
  try {
    if (!opts.force) {
      const latest = await latestRunForKind(productId, "enrich");
      if (latest?.status === "succeeded") {
        dev.log("ai-enrich skipped (already succeeded)", productId);
        return { ok: true };
      }
    }

    // Clear prior FAILED enrich rows so step 2's polling doesn't see
    // a stale failure before the worker has had time to insert the
    // new `running` row. Successful + running rows are left alone:
    //   - running: an in-flight job we shouldn't disturb
    //   - succeeded: useful audit history; doesn't poison polling
    //     because the LATEST row will be the new one once the worker
    //     starts
    await db
      .delete(aiRuns)
      .where(
        and(
          eq(aiRuns.productId, productId),
          eq(aiRuns.kind, "enrich"),
          eq(aiRuns.status, "failed"),
        ),
      );

    // BullMQ deduplicates jobs by `jobId`. With a 7-day failure
    // retention, the old failed job sits in Redis and silently
    // swallows new add()s with the same id — the worker never gets
    // a new job, polling loops forever. Remove first; ignore errors
    // for "job is active" (the in-flight worker will produce its own
    // result and the add() below becomes a benign no-op) or
    // "doesn't exist" (fresh draft).
    await aiEnrichQueue.remove(productId).catch(() => {
      /* fine — see comment above */
    });

    // jobIds are queue-scoped, so the product UUID alone is unique.
    // (`:` is disallowed in BullMQ custom IDs — Redis-key reserved.)
    await aiEnrichQueue.add("enrich", { productId }, { jobId: productId });
    dev.log("ai-enrich enqueued", productId, opts.force ? "(forced)" : "");
    return { ok: true };
  } catch (err) {
    dev.error("enqueueEnrichJob error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

async function setStatus(
  id: string,
  status: "draft" | "archived",
  eventType: string,
): Promise<DraftActionResult> {
  await requireSession();
  try {
    await db
      .update(products)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(products.id, id));
    dev.log(`status → ${status}`, id, eventType);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error(`setStatus(${status}) DB error:`, err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}
