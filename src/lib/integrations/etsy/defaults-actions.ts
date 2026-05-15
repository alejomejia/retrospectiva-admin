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

const SaveSchema = z.object({
  shippingProfileId: EtsyIdOrNull,
  returnPolicyId: EtsyIdOrNull,
});

export type SaveEtsyDefaultsInput = {
  shippingProfileId: string;
  returnPolicyId: string;
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

  dev.log("saved defaults", { shippingProfileId, returnPolicyId });
  revalidatePath("/settings/etsy");
  return { ok: true };
}
