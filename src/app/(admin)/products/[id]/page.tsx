import { notFound } from "next/navigation";

import { NewProductStepper } from "@/components/forms/new-product/new-product-stepper";
import { PageHeader } from "@/components/layout/page-header";
import { ProductEditForm } from "@/components/products/edit-form";
import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import { getProduct } from "@/lib/products/actions";
import { getAllBuyPriceDefaults } from "@/lib/products/buy-price-defaults";
import { listProductImages } from "@/lib/products/images-actions";
import { listProductVideos } from "@/lib/products/videos-actions";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";
import { getProductSettings } from "@/lib/products/settings";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const [images, videos, oauthRows, buyPriceDefaults, settings] =
    await Promise.all([
      listProductImages(id),
      listProductVideos(id),
      db
        .select({ markupPercent: etsyOauth.markupPercent })
        .from(etsyOauth)
        .limit(1),
      getAllBuyPriceDefaults(),
      getProductSettings(),
    ]);
  const shopMarkupPercent =
    oauthRows[0]?.markupPercent ?? DEFAULT_MARKUP_PERCENT;
  const shopAiImageEnabled = settings.aiImageEnabled;

  const imageItems: ImageListItem[] = images.map((img) => ({
    id: img.id,
    url: publicUrlFor(img.r2Key, R2_PUBLIC_BASE_URL),
    order: img.order,
    width: img.width,
    height: img.height,
  }));
  const videoItems: VideoListItem[] = videos.map((v) => ({
    id: v.id,
    url: publicUrlFor(v.r2Key, R2_PUBLIC_BASE_URL),
    posterUrl: v.posterR2Key
      ? publicUrlFor(v.posterR2Key, R2_PUBLIC_BASE_URL)
      : null,
    mimeType: v.mimeType,
    width: v.width,
    height: v.height,
    durationMs: v.durationMs,
    order: v.order,
  }));

  const isDraft = product.status === "draft";

  return (
    <>
      <PageHeader>
        <PageHeader.Column className="flex-1 flex-col">
          <PageHeader.Back
            href="/products"
            label={m.products.detail.backLink}
          />
          <div className="flex items-center gap-3">
            <PageHeader.Title>
              {product.titleEs ?? m.products.detail.untitled}
            </PageHeader.Title>
            <Badge
              variant={product.status === "draft" ? "outline" : "default"}
              className="text-caplet"
            >
              {m.products.statuses[product.status]}
            </Badge>
          </div>
        </PageHeader.Column>
      </PageHeader>

      {isDraft ? (
        <NewProductStepper
          product={product}
          shopMarkupPercent={shopMarkupPercent}
          shopAiImageEnabled={shopAiImageEnabled}
          buyPriceDefaults={buyPriceDefaults}
          imageItems={imageItems}
          videoItems={videoItems}
        />
      ) : (
        <ProductEditForm
          product={product}
          shopMarkupPercent={shopMarkupPercent}
          shopAiImageEnabled={shopAiImageEnabled}
          imageItems={imageItems}
          videoItems={videoItems}
        />
      )}
    </>
  );
}
