"use server";

import { eq } from "drizzle-orm";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

const dev = devGroup("products");

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
  const [row] = await db
    .insert(products)
    .values({})
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
