"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { devGroup } from "@/lib/utils/dev";
import { priceEurToCents } from "@/lib/utils/money";
import { ProductFormSchema, type ProductFormValues } from "./schema";

const dev = devGroup("products");

export type CreateDraftResult = { id: string };

/**
 * Inserts a minimal draft so the user can land on the unified
 * edit/detail page and upload media + fill in details there. The
 * route handler at `/products/new` calls this then `redirect()`s to
 * `/products/{id}?new=1`.
 *
 * Bypasses `ProductFormSchema` validation on purpose — the placeholder
 * values would fail (`priceCents=0` would fail the `> 0` refine).
 * Validation kicks in when the user saves their first edit via
 * `updateProduct`.
 *
 * The placeholder name `"Sin título"` is hardcoded here rather than
 * exported because `"use server"` files can't export non-async values.
 * A Phase 9 "archive empty drafts" cleanup job can grep for the same
 * literal.
 */
export async function createDraftProduct(): Promise<CreateDraftResult> {
  const session = await requireSession();
  const [row] = await db
    .insert(products)
    .values({ name: "Sin título", priceCents: 0 })
    .returning({ id: products.id });
  if (!row) {
    throw new Error("Could not create draft product");
  }
  await db.insert(events).values({
    productId: row.id,
    actor: session.username,
    type: "product.created",
    payloadJson: { auto: true, name: "Sin título" },
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

export type UpdateProductResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Updates a product's editable fields (currently just name + price).
 * Allowed in any status — sold/archived items can still be edited for
 * record-keeping, the public website filters them out anyway. The Etsy
 * sync hook lights up in Phase 4: if a `published` product is edited,
 * we'll also PATCH the listing on Etsy. For now we just record the
 * change locally.
 *
 * Returns `{ ok: false }` on validation or DB failure so the client
 * can toast the message. On success, revalidates the detail page so
 * the read-only view sees the new data.
 */
export async function updateProduct(
  id: string,
  values: ProductFormValues,
): Promise<UpdateProductResult> {
  const session = await requireSession();
  const parsed = ProductFormSchema.safeParse(values);
  if (!parsed.success) {
    dev.warn("updateProduct: zod failed", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { name, priceEur } = parsed.data;
  const priceCents = priceEurToCents(priceEur);

  const [before] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!before) return { ok: false, error: m.errors.productNotFound };

  // Cheap no-op skip: if nothing changed, don't bump updatedAt or write
  // an empty event row.
  if (before.name === name && before.priceCents === priceCents) {
    dev.log("updateProduct: no-op (nothing changed)", id);
    return { ok: true };
  }

  try {
    await db
      .update(products)
      .set({ name, priceCents, updatedAt: sql`now()` })
      .where(eq(products.id, id));

    await db.insert(events).values({
      productId: id,
      actor: session.username,
      type: "product.updated",
      payloadJson: {
        before: { name: before.name, priceCents: before.priceCents },
        after: { name, priceCents },
      },
    });

    // TODO(phase-4-etsy-sync): if (before.status === 'published') {
    //   await syncListingToEtsy(before.etsyListingId, { title: name, price: priceCents });
    // }
    // Skip when status is 'draft' (not on Etsy yet) or 'archived' /
    // 'sold' (Etsy listings for sold items are read-only).

    dev.log("updated:", id);
    revalidatePath(`/products/${id}`);
    return { ok: true };
  } catch (err) {
    dev.error("updateProduct DB error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? m.errors.couldNotSaveChangesDetail(err.message)
          : m.errors.couldNotSaveChanges,
    };
  }
}
