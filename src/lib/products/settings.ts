import { db } from "@/lib/db/client";
import { productSettings } from "@/lib/db/schema";

const SINGLETON_ID = "singleton";

export type ProductSettings = {
  aiImageEnabled: boolean;
  /** null = no default model picked; new drafts inherit null. */
  aiDefaultModelId: string | null;
  /** null = use the per-category default at worker time. */
  aiDefaultSourcePanel: string | null;
  aiDefaultPosePreset: string;
  aiDefaultFramingPreset: string;
  aiDefaultEnvironmentPreset: string;
  aiDefaultImageQuality: string;
  /** Shop-wide care/legal boilerplate appended to every listing. "" = none. */
  listingFooterEs: string;
  listingFooterEn: string;
  /** Default sale % written to a product when its discount toggle goes on. */
  defaultDiscountPercent: number;
};

const DEFAULTS: ProductSettings = {
  aiImageEnabled: true,
  aiDefaultModelId: null,
  aiDefaultSourcePanel: null,
  aiDefaultPosePreset: "soft_relaxed",
  aiDefaultFramingPreset: "waist_up",
  aiDefaultEnvironmentPreset: "textured_wall",
  aiDefaultImageQuality: "low",
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
      aiImageEnabled: productSettings.aiImageEnabled,
      aiDefaultModelId: productSettings.aiDefaultModelId,
      aiDefaultSourcePanel: productSettings.aiDefaultSourcePanel,
      aiDefaultPosePreset: productSettings.aiDefaultPosePreset,
      aiDefaultFramingPreset: productSettings.aiDefaultFramingPreset,
      aiDefaultEnvironmentPreset: productSettings.aiDefaultEnvironmentPreset,
      aiDefaultImageQuality: productSettings.aiDefaultImageQuality,
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
