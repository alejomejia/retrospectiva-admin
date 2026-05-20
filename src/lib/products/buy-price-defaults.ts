"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import {
  clothingBuyPriceDefaults,
  type ClothingType,
} from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { devGroup } from "@/lib/utils/dev";
import { MONEY_STRING_RE, priceEurToCents } from "@/lib/utils/money";

import { CLOTHING_TYPES } from "./clothing-types";

const dev = devGroup("products.buy-price-defaults");

/** Public read shape: { clothingType: cents | null }. */
export type BuyPriceDefaultsMap = Record<ClothingType, number | null>;

/**
 * Load all buy-price defaults keyed by clothing_type. Missing rows
 * map to `null` so the caller can render every clothing type with an
 * empty-vs-set distinction.
 */
export async function getAllBuyPriceDefaults(): Promise<BuyPriceDefaultsMap> {
  const rows = await db.select().from(clothingBuyPriceDefaults);
  const map = Object.fromEntries(
    CLOTHING_TYPES.map((t) => [t.value, null as number | null]),
  ) as BuyPriceDefaultsMap;
  for (const row of rows) {
    map[row.clothingType] = row.defaultBuyPriceCents;
  }
  return map;
}

/**
 * Single-row lookup used by the product autosave path. Returns the
 * default in cents or `null` if no default has been set for this
 * clothing type yet. Not exported as a server action — call from
 * server-only code paths.
 */
export async function getBuyPriceDefaultForClothingType(
  clothingType: ClothingType,
): Promise<number | null> {
  const all = await getAllBuyPriceDefaults();
  return all[clothingType] ?? null;
}

const BuyPriceEurOrNull = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .regex(MONEY_STRING_RE, "must be a money string"),
    ]),
  );

const ClothingTypeEnum = z.enum(
  CLOTHING_TYPES.map((t) => t.value) as [ClothingType, ...ClothingType[]],
);

const SaveSchema = z.object({
  clothingType: ClothingTypeEnum,
  priceEur: BuyPriceEurOrNull,
});

const SaveAllSchema = z.object({
  entries: z.array(
    z.object({
      clothingType: ClothingTypeEnum,
      priceEur: BuyPriceEurOrNull,
    }),
  ),
});

export type SaveBuyPriceDefaultInput = {
  clothingType: ClothingType;
  /** Money string (e.g. `"12.50"`) or empty to clear the default. */
  priceEur: string;
};

export type SaveAllBuyPriceDefaultsInput = {
  entries: Array<{ clothingType: ClothingType; priceEur: string }>;
};

export type SaveBuyPriceDefaultResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Upsert (or clear) the default buy price for one clothing type.
 *
 * Empty `priceEur` deletes the row, leaving the column null and
 * future products with no auto-default for that type.
 *
 * NOTE: this never backfills existing `products.buy_price_cents` — the
 * snapshotting decision is intentional so historical earnings math
 * stays stable. See `clothing_buy_price_defaults` table comment.
 */
export async function saveBuyPriceDefault(
  input: SaveBuyPriceDefaultInput,
): Promise<SaveBuyPriceDefaultResult> {
  await requireSession();
  const parsed = SaveSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid buy-price-default input:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }
  const { clothingType, priceEur } = parsed.data;

  try {
    if (priceEur === null) {
      await db
        .delete(clothingBuyPriceDefaults)
        .where(eq(clothingBuyPriceDefaults.clothingType, clothingType));
    } else {
      const cents = priceEurToCents(priceEur);
      await db
        .insert(clothingBuyPriceDefaults)
        .values({ clothingType, defaultBuyPriceCents: cents })
        .onConflictDoUpdate({
          target: clothingBuyPriceDefaults.clothingType,
          set: {
            defaultBuyPriceCents: cents,
            updatedAt: new Date(),
          },
        });
    }
    dev.log("saved buy-price default", { clothingType, priceEur });
    revalidatePath("/settings/products");
    return { ok: true };
  } catch (err) {
    dev.error("saveBuyPriceDefault DB error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? m.errors.couldNotSaveChangesDetail(err.message)
          : m.errors.couldNotSaveChanges,
    };
  }
}

/**
 * Batch upsert/clear of buy-price defaults. Called from the
 * /settings/products card on Save. Each entry follows the same rules
 * as the single-row action: empty `priceEur` deletes the row.
 */
export async function saveAllBuyPriceDefaults(
  input: SaveAllBuyPriceDefaultsInput,
): Promise<SaveBuyPriceDefaultResult> {
  await requireSession();
  const parsed = SaveAllSchema.safeParse(input);
  if (!parsed.success) {
    dev.warn("invalid buy-price-defaults batch:", parsed.error.issues);
    return { ok: false, error: m.errors.invalidForm };
  }

  try {
    for (const { clothingType, priceEur } of parsed.data.entries) {
      if (priceEur === null) {
        await db
          .delete(clothingBuyPriceDefaults)
          .where(eq(clothingBuyPriceDefaults.clothingType, clothingType));
      } else {
        const cents = priceEurToCents(priceEur);
        await db
          .insert(clothingBuyPriceDefaults)
          .values({ clothingType, defaultBuyPriceCents: cents })
          .onConflictDoUpdate({
            target: clothingBuyPriceDefaults.clothingType,
            set: {
              defaultBuyPriceCents: cents,
              updatedAt: new Date(),
            },
          });
      }
    }
    dev.log("saved all buy-price defaults", {
      count: parsed.data.entries.length,
    });
    revalidatePath("/settings/products");
    return { ok: true };
  } catch (err) {
    dev.error("saveAllBuyPriceDefaults DB error:", err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? m.errors.couldNotSaveChangesDetail(err.message)
          : m.errors.couldNotSaveChanges,
    };
  }
}
