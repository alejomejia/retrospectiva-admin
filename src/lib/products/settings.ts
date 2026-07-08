import { db } from "@/lib/db/client";
import { productSettings } from "@/lib/db/schema";

const SINGLETON_ID = "singleton";

export type ProductSettings = {
  /** Shop-wide care/legal boilerplate appended to every listing. "" = none. */
  listingFooterEs: string;
  listingFooterEn: string;
  /** Default sale % written to a product when its discount toggle goes on. */
  defaultDiscountPercent: number;
};

const DEFAULTS: ProductSettings = {
  listingFooterEs: "",
  listingFooterEn: "",
  defaultDiscountPercent: 25,
};

/**
 * Read the singleton `product_settings` row. Returns column defaults
 * when the row has never been written — callers don't need to handle
 * the "no row yet" case.
 */
export async function getProductSettings(): Promise<ProductSettings> {
  const [row] = await db
    .select({
      listingFooterEs: productSettings.listingFooterEs,
      listingFooterEn: productSettings.listingFooterEn,
      defaultDiscountPercent: productSettings.defaultDiscountPercent,
    })
    .from(productSettings)
    .limit(1);
  if (!row) return DEFAULTS;
  return row;
}

export { SINGLETON_ID as PRODUCT_SETTINGS_ID };
