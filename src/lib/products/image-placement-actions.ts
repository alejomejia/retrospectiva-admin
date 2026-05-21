"use server";

import { and, eq } from "drizzle-orm";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { aiRuns, productImages, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { latestRunForKind } from "@/lib/integrations/openai/ai-runs-log";
import { aiImagePlacementQueue } from "@/lib/queue/queues";
import { devGroup } from "@/lib/utils/dev";

import { getProductSettings } from "./settings";

const dev = devGroup("products.image-placement");

export type ImagePlacementActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Enqueue the on-model image generation job for a product (Task 11).
 *
 * Pre-flight gating happens server-side, **not** just in the UI: a
 * stale tab, a future migration backfill, or a CLI script would
 * otherwise burn an OpenAI call against the user's intent. We refuse
 * the enqueue (toast surfaces the reason) when any of:
 *
 *   - shop-wide AI image toggle is off AND per-product override
 *     hasn't flipped it on,
 *   - per-product override is explicitly off,
 *   - no `aiModelId` selected,
 *   - no `ai_reference` image uploaded,
 *   - `clothingType` is null (the prompt requires the English label).
 *
 * Idempotent by default: if the latest `ai_runs` row of
 * `kind='model_placement'` is `succeeded`, returns `{ok: true}`
 * without re-enqueueing — re-running would burn another OpenAI call
 * and overwrite the `ai_model`-role image. Pass `{force: true}` (from
 * the Regenerar button) to bypass.
 */
export async function generateProductImage(
  productId: string,
  opts: { force?: boolean } = {},
): Promise<ImagePlacementActionResult> {
  await requireSession();

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product) {
      return { ok: false, error: m.errors.productNotFound };
    }

    const settings = await getProductSettings();
    const aiImageOn = product.aiImageEnabled ?? settings.aiImageEnabled;
    if (!aiImageOn) {
      return {
        ok: false,
        error: m.products.stepper.step1.aiImageSection.errors.disabled,
      };
    }
    if (product.aiModelId === null) {
      return {
        ok: false,
        error: m.products.stepper.step1.aiImageSection.errors.noModel,
      };
    }
    if (product.clothingType === null) {
      return {
        ok: false,
        error: m.products.stepper.step1.aiImageSection.errors.noClothingType,
      };
    }

    const [reference] = await db
      .select({ id: productImages.id })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, productId),
          eq(productImages.role, "ai_reference"),
        ),
      )
      .limit(1);
    if (!reference) {
      return {
        ok: false,
        error: m.products.stepper.step1.aiImageSection.errors.noReference,
      };
    }

    if (!opts.force) {
      const latest = await latestRunForKind(productId, "model_placement");
      if (latest?.status === "succeeded") {
        dev.log("ai-image-placement skipped (already succeeded)", productId);
        return { ok: true };
      }
    }

    // Clear stale failed rows so step-1's polling doesn't see a stale
    // failure before the worker can insert a fresh `running` row.
    await db
      .delete(aiRuns)
      .where(
        and(
          eq(aiRuns.productId, productId),
          eq(aiRuns.kind, "model_placement"),
          eq(aiRuns.status, "failed"),
        ),
      );

    // BullMQ dedupes by jobId. Remove first to defeat the 7-day
    // failure-retention coalescing that would silently swallow this
    // re-enqueue. See `enqueueEnrichJob` for the parallel rationale.
    await aiImagePlacementQueue.remove(productId).catch(() => {
      /* no prior job, or active — both fine */
    });
    await aiImagePlacementQueue.add(
      "placement",
      { productId },
      { jobId: productId },
    );
    dev.log(
      "ai-image-placement enqueued",
      productId,
      opts.force ? "(forced)" : "",
    );
    return { ok: true };
  } catch (err) {
    dev.error("generateProductImage error", err);
    return { ok: false, error: m.errors.couldNotSaveChanges };
  }
}
