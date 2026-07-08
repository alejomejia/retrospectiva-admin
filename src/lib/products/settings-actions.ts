"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { productSettings } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.en";
import { devGroup } from "@/lib/utils/dev";
import { PRODUCT_SETTINGS_ID } from "./settings";

const dev = devGroup("products.settings");

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Generous ceiling — boilerplate care/legal text, not a novel. */
const FOOTER_MAX_LEN = 2000;

const ListingFooterSchema = z.object({
  listingFooterEs: z.string().max(FOOTER_MAX_LEN),
  listingFooterEn: z.string().max(FOOTER_MAX_LEN),
});

export type SaveListingFooterInput = z.infer<typeof ListingFooterSchema>;

/**
 * Persist the shop-wide listing footer (care/legal boilerplate) on the
 * singleton `product_settings` row. Stored as an ES/EN pair the
 * operator maintains by hand — never machine-translated — and appended
 * to every listing at the Etsy + website payload boundary.
 */
export async function saveListingFooter(
  input: SaveListingFooterInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = ListingFooterSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid listing footer input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { listingFooterEs, listingFooterEn } = parsed.data;

  await db
    .insert(productSettings)
    .values({ id: PRODUCT_SETTINGS_ID, listingFooterEs, listingFooterEn })
    .onConflictDoUpdate({
      target: productSettings.id,
      set: { listingFooterEs, listingFooterEn, updatedAt: sql`now()` },
    });

  dev.log("saved shop listing footer");
  revalidatePath("/settings/products");
  return { ok: true };
}

const DefaultDiscountSchema = z.object({
  defaultDiscountPercent: z.coerce.number().int().min(1).max(99),
});

export type SaveDefaultDiscountInput = {
  defaultDiscountPercent: number | string;
};

/**
 * Persist the shop-wide default discount percentage on the singleton
 * `product_settings` row. Written to `products.discount_percent` when
 * the product form's discount toggle is switched on; the operator can
 * still override it per product. Upserts so the row materializes on
 * first write — no separate seed migration needed.
 */
export async function saveDefaultDiscount(
  input: SaveDefaultDiscountInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = DefaultDiscountSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid default discount input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { defaultDiscountPercent } = parsed.data;

  await db
    .insert(productSettings)
    .values({ id: PRODUCT_SETTINGS_ID, defaultDiscountPercent })
    .onConflictDoUpdate({
      target: productSettings.id,
      set: { defaultDiscountPercent, updatedAt: sql`now()` },
    });

  dev.log("saved shop default discount", { defaultDiscountPercent });
  revalidatePath("/settings/products");
  return { ok: true };
}
