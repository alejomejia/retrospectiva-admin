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

const SaveSchema = z.object({
  shippingProfileId: EtsyIdOrNull,
  returnPolicyId: EtsyIdOrNull,
  markupPercent: MarkupPercent,
});

export type SaveEtsyDefaultsInput = {
  shippingProfileId: string;
  returnPolicyId: string;
  markupPercent: string;
};

export type SaveEtsyDefaultsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Persist the shop-wide publish defaults onto the single
 * `etsy_oauth` row.
 *
 * - Single-shop admin: we use the only row in `etsy_oauth`.
 * - Either value can be cleared by passing an empty string from the
 *   form.
 * - Returns a typed result instead of throwing so the form can
 *   render the error inline.
 */
export async function saveEtsyDefaults(
  input: SaveEtsyDefaultsInput,
): Promise<SaveEtsyDefaultsResult> {
  await requireSession();

  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { shippingProfileId, returnPolicyId, markupPercent } = parsed.data;

  const [row] = await db.select().from(etsyOauth).limit(1);
  if (!row) {
    return { ok: false, error: m.settings.etsy.defaults.notConnectedError };
  }

  await db
    .update(etsyOauth)
    .set({
      defaultShippingProfileId: shippingProfileId,
      defaultReturnPolicyId: returnPolicyId,
      // Empty string → null → fall back to schema default (30). The
      // NOT NULL column means we coerce to 30 on the way out.
      markupPercent: markupPercent ?? 30,
      updatedAt: new Date(),
    })
    .where(eq(etsyOauth.id, row.id));

  dev.log("saved defaults", {
    shippingProfileId,
    returnPolicyId,
    markupPercent,
  });
  // Revalidate both the settings page and the products list (the list
  // recomputes Etsy prices from the shop markup).
  revalidatePath("/settings/etsy");
  revalidatePath("/products");
  return { ok: true };
}
