"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";
import { priceEurToCents } from "@/lib/utils/money";
import { eq } from "drizzle-orm";
import { ProductFormSchema, type ProductFormValues } from "./schema";

const dev = devGroup("products");

export type CreateProductResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Creates a draft product. Returns the new id on success so the client
 * can navigate to the detail page; returns `{ ok: false }` on validation
 * failure so the form can render the message in a toast.
 *
 * We don't `redirect()` from here — letting the client decide keeps the
 * action testable and lets the toast fire before the navigation.
 */
export async function createProduct(
  values: ProductFormValues,
): Promise<CreateProductResult> {
  const session = await requireSession();
  const parsed = ProductFormSchema.safeParse(values);
  if (!parsed.success) {
    dev.warn("createProduct: zod failed", parsed.error.issues);
    return { ok: false, error: "Invalid form input." };
  }
  const { name, priceEur } = parsed.data;
  const priceCents = priceEurToCents(priceEur);

  try {
    const [row] = await db
      .insert(products)
      .values({ name, priceCents })
      .returning({ id: products.id });
    if (!row) {
      return { ok: false, error: "Could not save product." };
    }
    await db.insert(events).values({
      productId: row.id,
      actor: session.username,
      type: "product.created",
      payloadJson: { name, priceCents },
    });
    dev.log("created:", row.id, name);
    return { ok: true, id: row.id };
  } catch (err) {
    dev.error("createProduct DB error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not save product: ${err.message}`
          : "Could not save product.",
    };
  }
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
