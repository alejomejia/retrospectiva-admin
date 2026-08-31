"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiRuns, etsyOauth, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import { featuredSlotFullForProduct } from "@/lib/integrations/etsy/publish";
import { latestRunForKind } from "@/lib/integrations/openai/ai-runs-log";
import {
  TRANSLATABLE_FIELDS,
  runTranslation,
  translateText,
} from "@/lib/integrations/openai/translate";
import { buildSlug } from "@/lib/products/slug";
import {
  REGENERABLE_FIELDS,
  type RegenerableField,
  type RegeneratedValue,
  regenerateField,
} from "@/lib/integrations/openai/regenerate-field";
import {
  aiEnrichQueue,
  etsyPublishQueue,
  websiteWebhookQueue,
  type WebsiteWebhookKind,
} from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import { getBuyPriceDefaultForClothingType } from "./buy-price-defaults";
import {
  getEtsyTaxonomyForClothingType,
  getShippingWeightClass,
} from "./clothing-types";
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
        // Clear the shipping profile alongside taxonomy when the user
        // unsets the clothing type; it will be re-derived once a new
        // type is picked.
        if (set.shippingProfileId === undefined) {
          set.shippingProfileId = null;
        }
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
        // Same pattern for the shipping profile: resolve from the
        // shop-wide weight-class mapping on every clothing-type
        // change. The user can still override the picked profile via
        // the step-1 dropdown — an explicit `shippingProfileId` in
        // the same patch wins over the auto-pick.
        if (set.shippingProfileId === undefined) {
          set.shippingProfileId = await resolveShippingProfileId(ct);
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

/**
 * Resolve the shop-wide Etsy shipping profile id for the given
 * clothing type via its registered weight class. Returns `null` when
 * the shop isn't connected yet OR the operator hasn't filled in a
 * profile for that weight class in /settings/integrations.
 */
async function resolveShippingProfileId(
  ct: Exclude<ProductDraftPatch["clothingType"], null | undefined>,
): Promise<number | null> {
  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) return null;
  switch (getShippingWeightClass(ct)) {
    case "light":
      return row.shippingProfileLightId;
    case "medium":
      return row.shippingProfileMediumId;
    case "heavy":
      return row.shippingProfileHeavyId;
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
 * The app is one-way (admin → Etsy), so these only mutate local
 * state — none of them touch the live Etsy listing. `sold` and
 * `archive` additionally notify the public website so the store
 * re-validates the product.
 */

/** Statuses a product can be marked sold from — all imply it has (or
 *  had) a live listing/store presence. A never-published draft can't
 *  be "sold". */
const SELLABLE_STATUSES: ReadonlySet<string> = new Set([
  "published",
  "scheduled",
  "archived",
]);

/**
 * Best-effort website revalidation. Mirrors the publish path: a Redis
 * hiccup here must not fail the user's action, since the DB status is
 * already committed.
 *
 * NOTE: deliberately NO custom `jobId`. A `${kind}-${productId}` jobId
 * coalesces — but BullMQ ignores `add()` for a jobId that still exists in
 * Redis, INCLUDING a completed job retained by `removeOnComplete` (24 h).
 * That silently dropped every repeat action on the same product within the
 * window (a second "update website" did nothing). These are explicit,
 * idempotent user actions, so each must enqueue its own job and run.
 */
async function notifyWebsite(
  productId: string,
  kind: WebsiteWebhookKind,
): Promise<void> {
  try {
    await websiteWebhookQueue.add(kind, { productId, kind });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dev.warn("website webhook enqueue failed (non-fatal)", productId, kind, msg);
  }
}

/**
 * Actual sale proceeds, in EUR cents. A positive integer — the operator
 * types a money string in the UI and the client converts to cents.
 */
const SoldPriceCentsSchema = z.number().int().positive();

/**
 * Manually mark a product as sold. Distinct from archive: a sold
 * garment stays visible on the store (flagged sold), an archived one
 * is pulled. Persists the actual sale proceeds (`sold_price_cents`) —
 * the list price sent to Etsy is not the earnings, so this is the clean
 * figure for reporting — then sets `sold_at` and fires the `sold`
 * website webhook. Allowed from `published` / `scheduled` / `archived`.
 */
export async function markAsSold(
  id: string,
  soldPriceCents: number,
): Promise<DraftActionResult> {
  await requireSession();
  const parsedPrice = SoldPriceCentsSchema.safeParse(soldPriceCents);
  if (!parsedPrice.success) {
    return { ok: false, error: m.errors.invalidForm };
  }
  try {
    const [row] = await db
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }
    if (!SELLABLE_STATUSES.has(row.status)) {
      return { ok: false, error: m.errors.couldNotSaveChanges };
    }

    await db
      .update(products)
      .set({
        status: "sold",
        soldPriceCents: parsedPrice.data,
        soldAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));
    dev.log("status → sold", id);

    await notifyWebsite(id, "sold");

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("markAsSold DB error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

/** Statuses a product can be manually marked published from. A
 *  `scheduled` row whose Etsy push half-completed (listing live but
 *  the status flip never committed) is the primary case; `archived`
 *  covers re-listing a pulled product that is back on Etsy. A `draft`
 *  is excluded on purpose — it has no live listing, so the real
 *  publish flow (`publishNow`) must run instead. */
const PUBLISHABLE_STATUSES: ReadonlySet<string> = new Set([
  "scheduled",
  "archived",
]);

/**
 * Manually reconcile a product to `status='published'` WITHOUT touching
 * Etsy. Use when the listing is already live on Etsy but the local
 * status is stale — e.g. a `scheduled` row whose publish job pushed the
 * listing but failed before committing the status flip (see
 * `runScheduledPublish`). Mirrors the tail of the real publish path:
 * freezes the public slug on first publish and fires the `publish`
 * website webhook. Any pending delayed publish job is dropped so the
 * schedule can't fire a duplicate push later. Allowed from
 * `scheduled` / `archived`.
 */
export async function markAsPublished(id: string): Promise<DraftActionResult> {
  await requireSession();
  try {
    const [row] = await db
      .select({
        status: products.status,
        slug: products.slug,
        titleEs: products.titleEs,
        titleEn: products.titleEn,
        websiteTitleEn: products.websiteTitleEn,
      })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }
    if (!PUBLISHABLE_STATUSES.has(row.status)) {
      return { ok: false, error: m.errors.couldNotSaveChanges };
    }

    // Freeze the public store slug on first publish — once set it never
    // changes so shared / indexed URLs stay valid (mirrors `publish`).
    // Built from the short storefront title (`websiteTitleEn`), falling
    // back to the long Etsy `titleEn` (then `titleEs`) for legacy rows
    // enriched before website titles existed.
    const slug =
      row.slug ??
      buildSlug(row.websiteTitleEn ?? row.titleEn ?? row.titleEs, id);

    await db
      .update(products)
      .set({
        status: "published",
        slug,
        // Freeze the first-publish timestamp once (COALESCE) — a manual
        // reconcile of an already-published-then-archived row must not
        // reset its "new" age. Mirrors the publish worker.
        publishedAt: sql`coalesce(${products.publishedAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));
    dev.log("status → published (manual reconcile)", id);

    // Drop any pending delayed publish job so a later fire can't push a
    // duplicate listing. "job is active" races self-cancel via the
    // worker's status check (it sees status='published' and skips).
    await etsyPublishQueue.remove(id).catch(() => {
      /* no prior job, or already active — both fine */
    });

    await notifyWebsite(id, "publish");

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("markAsPublished DB error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}

export async function archiveProduct(id: string): Promise<DraftActionResult> {
  const result = await setStatus(id, "archived", "product.archived");
  if (result.ok) {
    await notifyWebsite(id, "archive");
  }
  return result;
}

export async function restoreToDraft(id: string): Promise<DraftActionResult> {
  return setStatus(id, "draft", "product.restoredToDraft");
}

/**
 * Push edits made to an already-published product out to the public
 * website. Per-field autosave has already persisted the Spanish edits;
 * this action re-translates the four translatable ES columns to their
 * EN counterparts (the admin UI only edits Spanish, so the EN cache
 * would otherwise stay stale) and then enqueues an `update` website
 * webhook so the store re-validates with the fresh data.
 *
 * Website only — the live Etsy listing is intentionally left untouched
 * (the app is one-way admin→Etsy and the operator reconciles Etsy by
 * hand). Requires a product that has been pushed to Etsy at least once
 * (`etsy_listing_id` set); the website payload deep-links the listing
 * and can't be built without it.
 */
export async function updatePublishedProduct(
  id: string,
): Promise<DraftActionResult> {
  await requireSession();
  try {
    const [row] = await db
      .select({ etsyListingId: products.etsyListingId })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }
    if (row.etsyListingId == null) {
      return { ok: false, error: m.errors.couldNotSaveChanges };
    }

    // Re-translate EN→ES for every translatable field. Sequential to
    // keep the OpenAI call volume predictable; a single failure aborts
    // the push so we never ship a half-translated payload.
    for (const field of TRANSLATABLE_FIELDS) {
      await runTranslation(id, field);
    }

    await db
      .update(products)
      .set({ updatedAt: sql`now()` })
      .where(eq(products.id, id));

    await notifyWebsite(id, "update");

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("updatePublishedProduct error:", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
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

  // No featured-cap gate here on purpose: scheduling may be days out,
  // and a slot can free up before the job fires. The publish worker
  // checks at fire time and publishes unfeatured if the cap is still
  // full (`runScheduledPublish`).

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

/**
 * On-demand publish. Enqueues the same `etsy-publish` job the
 * scheduled flow uses, with `delay=0`. The worker runs the full
 * translation + Etsy push (`runScheduledPublish`); the row flips to
 * `status='published'` on success.
 *
 * Allowed from `draft` and `scheduled`. Scheduled runs are cancelled
 * implicitly by `etsyPublishQueue.remove` so the user doesn't get a
 * duplicate publish when the original delay fires later.
 */
export async function publishNow(id: string): Promise<DraftActionResult> {
  await requireSession();
  try {
    const [row] = await db
      .select({ status: products.status, isFeatured: products.isFeatured })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }
    if (row.status !== "draft" && row.status !== "scheduled") {
      return { ok: false, error: m.errors.couldNotSaveChanges };
    }
    // Pre-publish featured-cap gate: cancel before enqueuing so the
    // operator gets an immediate, actionable error instead of a
    // silently-failed background job.
    if (await featuredSlotFullForProduct(row.isFeatured)) {
      return {
        ok: false,
        error: m.products.stepper.publish.featuredCapReached,
      };
    }

    await db
      .update(products)
      .set({
        status: "scheduled",
        scheduledPublishAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, id));

    await etsyPublishQueue.remove(id).catch(() => {
      /* prior delayed job or active — both fine */
    });
    await etsyPublishQueue.add(
      "publish",
      { productId: id },
      { jobId: id },
    );
    dev.log("etsy-publish now", id);

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("publishNow error", err);
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

export type RegenerateFieldResult =
  | { ok: true; value: RegeneratedValue["value"] }
  | { ok: false; error: string };

/**
 * Per-field AI regeneration, used by the per-input "Regenerar"
 * buttons in step 2. Synchronous (no queue / polling) because a
 * one-field generation is fast enough to wait on, and the client gets
 * the new value back inline — no router refresh, so the other field
 * inputs keep their in-progress user edits.
 *
 * The OpenAI call replays the cached input from the latest succeeded
 * enrich run (see `regenerateField`), so we don't burn extra tokens
 * re-describing the product on every per-field click.
 */
export async function regenerateProductFieldAction(
  productId: string,
  field: RegenerableField,
): Promise<RegenerateFieldResult> {
  await requireSession();
  if (!REGENERABLE_FIELDS.includes(field)) {
    return { ok: false, error: m.errors.invalidForm };
  }
  try {
    const result = await regenerateField(productId, field);
    return { ok: true, value: result.value };
  } catch (err) {
    dev.error("regenerateProductFieldAction error", productId, field, err);
    // Drizzle wraps DB errors and exposes the underlying PG message
    // on `.cause`. Without unwrapping it the toast just says "Failed
    // query: <sql>" with no actionable cause.
    const cause = (err as { cause?: unknown }).cause;
    const causeMessage =
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : null;
    const baseMessage =
      err instanceof Error ? err.message : String(err);
    const fullMessage = causeMessage
      ? `${causeMessage} — ${baseMessage}`
      : baseMessage;
    return {
      ok: false,
      error: m.errors.couldNotSaveChangesDetail(fullMessage),
    };
  }
}

export type SaveFooterOverrideResult =
  | { ok: true; footerEsOverride: string | null; footerEnOverride: string | null }
  | { ok: false; error: string };

/** Mirrors the settings footer ceiling. */
const FOOTER_OVERRIDE_MAX_LEN = 2000;

/**
 * Persist a per-product listing-footer override. The operator types
 * only English; we machine-translate it to Spanish once here and cache
 * both columns, so the publish + website paths stay pure column reads
 * (no per-publish OpenAI call). An empty EN value clears the override,
 * reverting the product to the shop-wide footer (both columns → null).
 *
 * Translating on save (rather than at publish) keeps the rare override
 * out of the hot publish path and matches the "ES columns are a cache"
 * precedent used by the AI-enriched fields.
 */
export async function saveListingFooterOverride(
  productId: string,
  footerEn: string,
): Promise<SaveFooterOverrideResult> {
  await requireSession();

  const trimmed = footerEn.trim();
  if (trimmed.length > FOOTER_OVERRIDE_MAX_LEN) {
    return { ok: false, error: m.errors.invalidForm };
  }

  try {
    // Empty → clear the override (inherit the shop-wide footer).
    const footerEs = trimmed ? await translateText(trimmed) : "";
    const footerEnOverride = trimmed || null;
    const footerEsOverride = trimmed ? footerEs : null;

    const [row] = await db
      .update(products)
      .set({
        listingFooterEsOverride: footerEsOverride,
        listingFooterEnOverride: footerEnOverride,
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, productId))
      .returning({ id: products.id });
    if (!row) {
      return { ok: false, error: m.errors.productNotFound };
    }

    dev.log("saved listing footer override", productId, {
      cleared: !trimmed,
    });
    return { ok: true, footerEsOverride, footerEnOverride };
  } catch (err) {
    dev.error("saveListingFooterOverride error", productId, err);
    const baseMessage = err instanceof Error ? err.message : String(err);
    return { ok: false, error: m.errors.couldNotSaveChangesDetail(baseMessage) };
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
