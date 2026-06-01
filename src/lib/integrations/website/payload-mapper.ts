import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  type ClothingType,
  type Product,
  productImages,
  productVideos,
  products,
} from "@/lib/db/schema";
import {
  type Measurement,
  doublesAtBoundary,
  getRequiredMeasurements,
} from "@/lib/products/clothing-types";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { inflatedListCents } from "@/lib/products/pricing";

import type { WebsiteWebhookKind } from "@/lib/queue/queues";

/**
 * Builds the bilingual JSON payload posted to the
 * `retrospectiva-website` revalidation endpoint. The website needs
 * both languages (visitor toggles `es` / `en` client-side), the
 * doubled-at-boundary measurements (admin stores flat), the Etsy
 * listing handle (deep-link to the Etsy product page), and the
 * public image URLs (consumer doesn't have R2 creds).
 *
 * The mapper is read-only — no `server-only` marker because the
 * BullMQ worker (which can't load `server-only` modules) imports
 * it. R2 base URL is read from `process.env` directly for the same
 * reason; see `docs/project-conventions.md` §1.
 */

export class WebsitePayloadError extends Error {
  override name = "WebsitePayloadError";
}

export type WebsiteImage = {
  url: string;
  role: "original" | "ai_model";
  rank: number;
  width: number | null;
  height: number | null;
};

export type WebsiteVideo = {
  url: string;
  posterUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

/** Doubled cm where applicable; null if not stored or not required. */
export type WebsiteMeasurements = {
  shoulderCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  riseCm: number | null;
  legCm: number | null;
  lengthCm: number | null;
  braSize: string | null;
};

export type WebsitePayload = {
  productId: string;
  kind: WebsiteWebhookKind;
  emittedAt: string;
  status: Product["status"];
  clothingType: ClothingType | null;
  condition: Product["condition"];
  size: string | null;
  featured: boolean;
  colors: { primary: string | null; secondary: string | null };
  title: { es: string; en: string };
  description: { es: string; en: string };
  tags: { es: string[]; en: string[] };
  materials: { es: string[]; en: string[] };
  era: string | null;
  basePriceCents: number | null;
  currency: string;
  // The real (sale) price the buyer pays — the effective list price.
  listPriceCents: number | null;
  // Per-product sale percentage, or null when no discount is set.
  discountPercent: number | null;
  // Inflated "compare-at" price to strike through, charm-rounded.
  // null when no discount is set. `listPriceCents` is the price after
  // the discount; this is what it's marked down *from*.
  compareAtPriceCents: number | null;
  measurements: WebsiteMeasurements;
  etsy: {
    listingId: number | null;
    state: string | null;
  };
  images: WebsiteImage[];
  video: WebsiteVideo | null;
  publishedAt: string | null;
  soldAt: string | null;
};

function r2BaseUrl(): string {
  const v = process.env.R2_PUBLIC_BASE_URL;
  if (!v) throw new WebsitePayloadError("R2_PUBLIC_BASE_URL is not set");
  return v;
}

function effectiveListPriceCents(row: Product): number | null {
  if (row.listPriceCentsOverride != null) return row.listPriceCentsOverride;
  if (row.basePriceCents == null) return null;
  const markup = row.markupPercentOverride ?? 30;
  return Math.round(row.basePriceCents * (1 + markup / 100));
}

type CmKey =
  | "shoulderCm"
  | "chestCm"
  | "waistCm"
  | "hipCm"
  | "riseCm"
  | "legCm"
  | "lengthCm";

const MEASUREMENT_COLUMN_MAP: Record<Exclude<Measurement, "braSize">, CmKey> = {
  shoulder: "shoulderCm",
  chest: "chestCm",
  waist: "waistCm",
  hip: "hipCm",
  rise: "riseCm",
  leg: "legCm",
  length: "lengthCm",
};

function buildMeasurements(row: Product): WebsiteMeasurements {
  const out: WebsiteMeasurements = {
    shoulderCm: null,
    chestCm: null,
    waistCm: null,
    hipCm: null,
    riseCm: null,
    legCm: null,
    lengthCm: null,
    braSize: row.braSize ?? null,
  };
  if (!row.clothingType) return out;
  const required = getRequiredMeasurements(row.clothingType);
  for (const m of required) {
    if (m === "braSize") continue;
    const col = MEASUREMENT_COLUMN_MAP[m];
    const raw = row[col] as number | null | undefined;
    if (raw == null) continue;
    const factor = doublesAtBoundary(row.clothingType, m) ? 2 : 1;
    out[col] = raw * factor;
  }
  return out;
}

/**
 * Returns the full webhook payload for `productId`. Throws
 * `WebsitePayloadError` if the product is missing or lacks
 * publish-critical fields (titles, descriptions, listing id).
 */
export async function buildWebsitePayload(input: {
  productId: string;
  kind: WebsiteWebhookKind;
}): Promise<WebsitePayload> {
  const { productId, kind } = input;

  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) {
    throw new WebsitePayloadError(`product ${productId} not found`);
  }

  const titleEs = (row.titleEs ?? "").trim();
  const titleEn = (row.titleEn ?? "").trim();
  const descriptionEs = (row.descriptionEs ?? "").trim();
  const descriptionEn = (row.descriptionEn ?? "").trim();
  if (!titleEs || !titleEn || !descriptionEs || !descriptionEn) {
    throw new WebsitePayloadError(
      `product ${productId} missing bilingual title/description`,
    );
  }
  if (row.etsyListingId == null) {
    throw new WebsitePayloadError(
      `product ${productId} has no etsy_listing_id (cannot deep-link)`,
    );
  }

  const imageRows = await db
    .select({
      r2Key: productImages.r2Key,
      role: productImages.role,
      order: productImages.order,
      width: productImages.width,
      height: productImages.height,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.order));

  const base = r2BaseUrl();

  const originals = imageRows
    .filter((r) => r.role === "original")
    .sort((a, b) => a.order - b.order);
  const aiModel = imageRows.find((r) => r.role === "ai_model") ?? null;
  const ordered: WebsiteImage[] = originals.map((r, i) => ({
    url: publicUrlFor(r.r2Key, base),
    role: "original",
    rank: i + 1,
    width: r.width,
    height: r.height,
  }));
  if (aiModel) {
    ordered.push({
      url: publicUrlFor(aiModel.r2Key, base),
      role: "ai_model",
      rank: ordered.length + 1,
      width: aiModel.width,
      height: aiModel.height,
    });
  }

  const [videoRow] = await db
    .select()
    .from(productVideos)
    .where(eq(productVideos.productId, productId))
    .orderBy(asc(productVideos.order))
    .limit(1);
  const video: WebsiteVideo | null = videoRow
    ? {
        url: publicUrlFor(videoRow.r2Key, base),
        posterUrl: videoRow.posterR2Key
          ? publicUrlFor(videoRow.posterR2Key, base)
          : null,
        mimeType: videoRow.mimeType,
        width: videoRow.width,
        height: videoRow.height,
        durationMs: videoRow.durationMs,
      }
    : null;

  const listCents = effectiveListPriceCents(row);
  const compareAtPriceCents =
    listCents != null && row.discountPercent
      ? inflatedListCents(listCents, row.discountPercent)
      : null;

  const now = new Date().toISOString();
  return {
    productId: row.id,
    kind,
    emittedAt: now,
    status: row.status,
    clothingType: row.clothingType,
    condition: row.condition,
    size: row.size,
    featured: row.isFeatured,
    colors: {
      primary: row.etsyPrimaryColor,
      secondary: row.etsySecondaryColor,
    },
    title: { es: titleEs, en: titleEn },
    description: { es: descriptionEs, en: descriptionEn },
    tags: { es: row.etsyTagsEs, en: row.etsyTagsEn },
    materials: { es: row.etsyMaterialsEs, en: row.etsyMaterialsEn },
    era: row.etsyWhenMade,
    basePriceCents: row.basePriceCents,
    currency: row.currency,
    listPriceCents: listCents,
    discountPercent: row.discountPercent ?? null,
    compareAtPriceCents,
    measurements: buildMeasurements(row),
    etsy: {
      listingId: row.etsyListingId,
      state: row.etsyState,
    },
    images: ordered,
    video,
    publishedAt: row.status === "published" ? row.updatedAt.toISOString() : null,
    soldAt: row.soldAt ? row.soldAt.toISOString() : null,
  };
}
