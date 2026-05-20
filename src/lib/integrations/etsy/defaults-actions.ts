"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { devGroup } from "@/lib/utils/dev";

const dev = devGroup("etsy.defaults");

/**
 * Numeric Etsy ID. Stringified at the form boundary because shadcn
 * `<Select>` posts strings; we coerce + validate here. Empty string
 * means "no value picked" — translated to `null` so the column gets
 * cleared.
 */
const EtsyIdOrNull = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .regex(/^\d+$/, "must be numeric")
        .transform((s) => Number(s)),
    ]),
  );

/**
 * Markup percent for the Etsy list-price calculation. Comes from the
 * form as a string; coerced + clamped to a small int.
 */
const MarkupPercent = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .regex(/^\d+$/, "must be numeric")
        .transform((s) => Number(s))
        .refine((n) => n >= 0 && n <= 500, "must be between 0 and 500"),
    ]),
  );

const EtsyDefaultsSchema = z.object({
  shippingProfileId: EtsyIdOrNull,
  returnPolicyId: EtsyIdOrNull,
});

const MarkupSchema = z.object({
  markupPercent: MarkupPercent,
});

export type SaveEtsyDefaultsInput = {
  shippingProfileId: string;
  returnPolicyId: string;
};

export type SaveShopMarkupInput = {
  markupPercent: string;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Persist Etsy-specific publish defaults (shipping profile + return
 * policy) onto the single `etsy_oauth` row.
 *
 * - Single-shop admin: we use the only row in `etsy_oauth`.
 * - Either value can be cleared by passing an empty string.
 * - Returns a typed result instead of throwing so the form can render
 *   the error inline.
 */
export async function saveEtsyDefaults(
  input: SaveEtsyDefaultsInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = EtsyDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid etsy defaults input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { shippingProfileId, returnPolicyId } = parsed.data;

  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) {
    return { ok: false, error: m.settings.etsy.defaults.notConnectedError };
  }

  await db
    .update(etsyOauth)
    .set({
      defaultShippingProfileId: shippingProfileId,
      defaultReturnPolicyId: returnPolicyId,
      updatedAt: new Date(),
    })
    .where(eq(etsyOauth.id, row.id));

  dev.log("saved etsy defaults", { shippingProfileId, returnPolicyId });
  revalidatePath("/settings/integrations");
  return { ok: true };
}

/**
 * Persist the shop-wide markup percent (used by the Etsy list-price
 * calculation but conceptually a product-pricing default, hence
 * exposed under /settings/products).
 *
 * Currently stored on the `etsy_oauth` row; will migrate to a
 * `shop_settings` table when that lands.
 *
 * Empty string clears the override and falls back to the schema
 * default (30%).
 */
export async function saveShopMarkup(
  input: SaveShopMarkupInput,
): Promise<SaveResult> {
  await requireSession();

  const parsed = MarkupSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid markup input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { markupPercent } = parsed.data;

  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) {
    return { ok: false, error: m.settings.etsy.defaults.notConnectedError };
  }

  await db
    .update(etsyOauth)
    .set({
      // Empty string → null → fall back to schema default (30). The
      // NOT NULL column means we coerce to 30 on the way out.
      markupPercent: markupPercent ?? 30,
      updatedAt: new Date(),
    })
    .where(eq(etsyOauth.id, row.id));

  dev.log("saved shop markup", { markupPercent });
  revalidatePath("/settings/products");
  // The product list recomputes Etsy prices from the shop markup.
  revalidatePath("/products");
  return { ok: true };
}
