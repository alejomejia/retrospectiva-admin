import { and, ilike, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import type { ImageListItem } from "@/components/products/image-list";
import { InstagramStudio } from "@/components/socials/instagram-studio";
import {
  SocialsProductPicker,
  type SocialsProductItem,
} from "@/components/socials/socials-product-picker";
import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { etsyOauth, productImages, products } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import type { Product } from "@/lib/db/schema";
import { getProduct } from "@/lib/products/actions";
import { defaultStoryFields } from "@/lib/products/instagram-story-fields";
import {
  STORY_VARIANTS,
  isVariantKey,
  type StoryVariantKey,
} from "@/lib/products/instagram-story-variants";
import { listProductImages } from "@/lib/products/images-actions";
import { listReadyProductVideos } from "@/lib/products/videos-actions";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

/** How many products the no-search "latest" row shows vs. a search returns. */
const LATEST_LIMIT = 5;
const SEARCH_LIMIT = 18;

/**
 * A variant page (`/socials/new`, `/socials/sold`): search or pick a product
 * eligible for this template, then — once `?productId=` is set — the studio
 * (photos + editable copy + preview) renders below. The variant fixes which
 * statuses are eligible (`new` → published, `sold` → sold).
 */
export default async function SocialsVariantPage({
  params,
  searchParams,
}: {
  params: Promise<{ variant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const { variant } = await params;
  if (!isVariantKey(variant)) redirect("/socials");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const productId = typeof sp.productId === "string" ? sp.productId : null;

  const statuses = STORY_VARIANTS.find((v) => v.key === variant)!.statuses;

  // Latest products for this variant (or search hits), newest first by the
  // moment that matters for the status: when sold for "sold", when it went
  // live for "new".
  const orderExpr =
    variant === "sold"
      ? sql`coalesce(${products.soldAt}, ${products.createdAt}) DESC`
      : sql`coalesce(${products.scheduledPublishAt}, ${products.createdAt}) DESC`;
  const where = q
    ? and(inArray(products.status, [...statuses]), ilike(products.titleEs, `%${q}%`))
    : inArray(products.status, [...statuses]);

  const rows = await db
    .select({
      id: products.id,
      titleEs: products.titleEs,
      status: products.status,
    })
    .from(products)
    .where(where)
    .orderBy(orderExpr)
    .limit(q ? SEARCH_LIMIT : LATEST_LIMIT);

  // First original photo (lowest `order`) per product, one query.
  const productIds = rows.map((r) => r.id);
  const thumbnails =
    productIds.length === 0
      ? []
      : await db.execute<{ product_id: string; r2_key: string }>(
          sql`SELECT DISTINCT ON (${productImages.productId})
              ${productImages.productId} AS product_id,
              ${productImages.r2Key} AS r2_key
            FROM ${productImages}
            WHERE ${productImages.productId} IN ${productIds}
              AND ${productImages.role} = 'original'
            ORDER BY ${productImages.productId}, ${productImages.order} ASC`,
        );
  const thumbByProductId = new Map<string, string>();
  for (const t of thumbnails) {
    thumbByProductId.set(t.product_id, publicUrlFor(t.r2_key, R2_PUBLIC_BASE_URL));
  }

  // Only products with a photo can render an asset.
  const items: SocialsProductItem[] = rows
    .map((r) => ({
      id: r.id,
      title: r.titleEs,
      status: r.status,
      thumbnailUrl: thumbByProductId.get(r.id) ?? null,
    }))
    .filter((r) => r.thumbnailUrl !== null);

  // Studio data — only when a product is chosen, valid for this variant, and
  // has photos. A stale/ineligible id just leaves the studio hidden.
  const studio = await loadStudioData(variant, productId, statuses);

  const heading =
    variant === "sold"
      ? m.socials.select.soldHeading
      : m.socials.select.newHeading;

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Back href="/socials" label={m.socials.select.back} />
          <PageHeader.Eyebrow number="04" label={m.socials.eyebrow} />
          <PageHeader.Title>{heading}</PageHeader.Title>
        </PageHeader.Column>
      </PageHeader>

      <main className="flex flex-col gap-8 p-6">
        <SocialsProductPicker
          variant={variant}
          initialQuery={q}
          items={items}
          selectedId={productId}
          hasQuery={q.length > 0}
        />

        {studio ? (
          <InstagramStudio
            productId={studio.productId}
            variant={variant}
            images={studio.images}
            videos={studio.videos}
            defaultFields={studio.defaultFields}
          />
        ) : null}
      </main>
    </>
  );
}

/** Loads the studio inputs for a chosen product, or `null` if not renderable. */
async function loadStudioData(
  variant: StoryVariantKey,
  productId: string | null,
  statuses: readonly Product["status"][],
) {
  if (!productId) return null;

  const product = await getProduct(productId);
  if (!product || !statuses.includes(product.status)) return null;

  const rows = await listProductImages(productId);
  if (rows.length === 0) return null;

  const images: ImageListItem[] = rows.map((img) => ({
    id: img.id,
    url: publicUrlFor(img.r2Key, R2_PUBLIC_BASE_URL),
    order: img.order,
    width: img.width,
    height: img.height,
  }));

  const videoRows = await listReadyProductVideos(productId);
  const videos = videoRows.map((v) => ({
    id: v.id,
    posterUrl: v.posterR2Key
      ? publicUrlFor(v.posterR2Key, R2_PUBLIC_BASE_URL)
      : null,
  }));

  const [oauth] = await db
    .select({ markupPercent: etsyOauth.markupPercent })
    .from(etsyOauth)
    .limit(1);
  const shopMarkupPercent = oauth?.markupPercent ?? DEFAULT_MARKUP_PERCENT;

  return {
    productId,
    images,
    videos,
    defaultFields: defaultStoryFields(variant, product, shopMarkupPercent),
  };
}
