import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

const dev = devGroup("etsy.publish");

/**
 * Scheduled-publish processor logic. Lives in its own file (not
 * inline in the BullMQ worker) so it can be unit-tested without
 * spinning up Redis + a Worker subscription.
 *
 * **Task 9 stub.** Re-reads the product row and flips
 * `status='scheduled' → 'published'` locally. The real Etsy push
 * — createDraftListing, image + video upload, inline
 * `runTranslation` per translatable field, `state="active"` —
 * lands in Phase 4c and replaces this function wholesale.
 *
 * Return shape:
 *   - `{ ok: true, skipped: true, reason: "..." }` when the row is
 *     missing or no longer scheduled (race with `cancelSchedule` —
 *     see `publish-worker.ts` for the narrative).
 *   - `{ ok: true, skipped: false }` when the status flip happened.
 *
 * Throws on DB errors; the worker wrapping this catches and reports.
 */
export type ScheduledPublishResult =
  | { ok: true; skipped: false }
  | { ok: true; skipped: true; reason: "missing" | "status" };

export async function runScheduledPublish(
  productId: string,
): Promise<ScheduledPublishResult> {
  const [row] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!row) {
    dev.log("skipped (row missing)", productId);
    return { ok: true, skipped: true, reason: "missing" };
  }
  if (row.status !== "scheduled") {
    dev.log(`skipped (status=${row.status})`, productId);
    return { ok: true, skipped: true, reason: "status" };
  }

  // TODO(phase-4c): replace this stub with the real Etsy push.
  //   1. Translate ES → EN inline per TRANSLATABLE_FIELDS.
  //   2. createDraftListing(...) with translated fields.
  //   3. Upload images + video.
  //   4. updateListing(state="active") + persist etsyListingId.
  await db
    .update(products)
    .set({ status: "published", updatedAt: sql`now()` })
    .where(eq(products.id, productId));

  return { ok: true, skipped: false };
}
