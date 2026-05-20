import { db } from "@/lib/db/client";
import { productSettings } from "@/lib/db/schema";

const SINGLETON_ID = "singleton";

export type ProductSettings = {
  aiImageEnabled: boolean;
};

const DEFAULTS: ProductSettings = {
  aiImageEnabled: true,
};

/**
 * Read the singleton `product_settings` row. Returns column defaults
 * when the row has never been written — callers don't need to handle
 * the "no row yet" case.
 */
export async function getProductSettings(): Promise<ProductSettings> {
  const [row] = await db
    .select({ aiImageEnabled: productSettings.aiImageEnabled })
    .from(productSettings)
    .limit(1);
  if (!row) return DEFAULTS;
  return { aiImageEnabled: row.aiImageEnabled };
}

export { SINGLETON_ID as PRODUCT_SETTINGS_ID };
