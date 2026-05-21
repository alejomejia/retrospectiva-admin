"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, products } from "@/lib/db/schema";
import { deleteR2Prefix } from "@/lib/integrations/r2/delete-prefix";
import { productPrefix } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import { devGroup } from "@/lib/utils/dev";

import { getProductSettings } from "./settings";

const dev = devGroup("products");

/** Statuses where hard-delete is allowed. Published/scheduled/sold are
 *  excluded to avoid desyncing with the Etsy listing. */
const DELETABLE_STATUSES = new Set(["draft", "archived"] as const);

export type CreateDraftResult = { id: string };

/**
 * Inserts a minimal draft so the user can land on the stepper and
 * progressively fill in the product. The route handler at
 * `/products/new` calls this then `redirect()`s to `/products/{id}`.
 *
 * A fresh draft is intentionally a row with most columns null. The
 * stepper enforces required fields per step; the publish action
 * enforces Etsy-required fields at the action boundary. There's no
 * server-side validation here besides "user is logged in".
 */
export async function createDraftProduct(): Promise<CreateDraftResult> {
  const session = await requireSession();
  // Snapshot the shop-wide AI placement defaults onto the new row.
  // Later changes to /settings/ai do NOT backfill existing drafts —
  // matches the `buyPriceCents` precedent. The operator can still
  // override every value per-product via the step-1 form.
  const settings = await getProductSettings();
  const [row] = await db
    .insert(products)
    .values({
      aiModelId: settings.aiDefaultModelId,
      aiSourcePanel: settings.aiDefaultSourcePanel,
      aiPosePreset: settings.aiDefaultPosePreset,
      aiFramingPreset: settings.aiDefaultFramingPreset,
      aiEnvironmentPreset: settings.aiDefaultEnvironmentPreset,
      aiImageQuality: settings.aiDefaultImageQuality,
    })
    .returning({ id: products.id });
  if (!row) {
    throw new Error("Could not create draft product");
  }
  await db.insert(events).values({
    productId: row.id,
    actor: session.username,
    type: "product.created",
    payloadJson: { auto: true },
  });
  dev.log("draft created:", row.id);
  return { id: row.id };
}

/**
 * Fetches a single product by id for the edit/detail page. Returns
 * `null` if not found (caller decides between 404 / not-found UI).
 */
export async function getProduct(id: string) {
  await requireSession();
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return row ?? null;
}

export type DeleteProductResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Hard-deletes a product and all of its media. Only allowed for
 * `draft` and `archived` rows — published/scheduled/sold products
 * are blocked at the action boundary to avoid orphaning the Etsy
 * listing.
 *
 * Order of operations:
 *   1. R2 prefix sweep (best-effort; an orphan R2 tree is recoverable,
 *      an orphan DB row pointing at deleted assets is not).
 *   2. DB delete — cascades remove `product_images`, `product_videos`,
 *      and product-scoped `ai_runs`. `events.product_id` is set to
 *      null by the FK so the history survives.
 *   3. Audit `product.deleted` event with the original id + title in
 *      the payload (productId is null because the row is gone).
 */
export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  const session = await requireSession();

  const [row] = await db
    .select({
      id: products.id,
      titleEs: products.titleEs,
      status: products.status,
      createdAt: products.createdAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return { ok: false, error: m.errors.productNotFound };

  if (!DELETABLE_STATUSES.has(row.status as "draft" | "archived")) {
    return { ok: false, error: m.errors.cannotDeleteProductStatus };
  }

  try {
    await deleteR2Prefix({ prefix: productPrefix(row.id, row.createdAt) });
  } catch (err) {
    dev.error("R2 prefix sweep failed (continuing with DB delete):", err);
  }

  await db.delete(products).where(eq(products.id, id));

  await db.insert(events).values({
    actor: session.username,
    type: "product.deleted",
    payloadJson: { id: row.id, titleEs: row.titleEs, status: row.status },
  });

  dev.log("deleted product:", row.id);
  revalidatePath("/products");
  return { ok: true };
}
