import { notFound } from "next/navigation";

import { NewProductStepper } from "@/components/forms/new-product/new-product-stepper";
import { PageHeader } from "@/components/layout/page-header";
import type { ImageListItem } from "@/components/products/image-list";
import type { VideoListItem } from "@/components/products/video-list";
import { Badge } from "@/components/ui/badge";
import { listActiveAiModels } from "@/lib/ai-models/actions";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import {
  listShippingProfiles,
  type ShippingProfile,
} from "@/lib/integrations/etsy/shop-config";
import { devError } from "@/lib/utils/dev";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import { getProduct } from "@/lib/products/actions";
import { getAllBuyPriceDefaults } from "@/lib/products/buy-price-defaults";
import {
  countOtherFeaturedProducts,
  FEATURED_LISTING_CAP,
} from "@/lib/products/featured";
import {
  getAiModelImage,
  getAiReferenceImage,
  listProductImages,
} from "@/lib/products/images-actions";
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

  const [
    images,
    videos,
    oauthRows,
    buyPriceDefaults,
    settings,
    aiModels,
    aiReferenceRow,
    aiModelImageRow,
    otherFeaturedCount,
  ] = await Promise.all([
    listProductImages(id),
    listProductVideos(id),
    db
      .select({
        shopId: etsyOauth.shopId,
        markupPercent: etsyOauth.markupPercent,
        shippingProfileLightId: etsyOauth.shippingProfileLightId,
        shippingProfileMediumId: etsyOauth.shippingProfileMediumId,
        shippingProfileHeavyId: etsyOauth.shippingProfileHeavyId,
        defaultReturnPolicyId: etsyOauth.defaultReturnPolicyId,
      })
      .from(etsyOauth)
      .limit(1),
    getAllBuyPriceDefaults(),
    getProductSettings(),
    listActiveAiModels(),
    getAiReferenceImage(id),
    getAiModelImage(id),
    countOtherFeaturedProducts(id),
  ]);
  // Disable the featured toggle once the shop already holds the max
  // number of *other* featured products; an already-featured product
  // can still toggle itself off (it's excluded from the count).
  const featuredSlotsFull = otherFeaturedCount >= FEATURED_LISTING_CAP;
  const shopMarkupPercent =
    oauthRows[0]?.markupPercent ?? DEFAULT_MARKUP_PERCENT;
  const shopAiImageEnabled = settings.aiImageEnabled;
  const hasAnyShippingMapping =
    oauthRows[0]?.shippingProfileLightId != null ||
    oauthRows[0]?.shippingProfileMediumId != null ||
    oauthRows[0]?.shippingProfileHeavyId != null;
  const etsyPoliciesConfigured =
    hasAnyShippingMapping && oauthRows[0]?.defaultReturnPolicyId != null;

  const shopId = oauthRows[0]?.shopId ?? null;
  // Shipping profiles are needed in both modes — draft uses the
  // select to pick one before publish; edit mode shows the current
  // selection (and lets the operator change it post-publish).
  const shippingProfiles: ShippingProfile[] =
    shopId !== null
      ? await listShippingProfiles(Number(shopId)).catch((err) => {
          devError("products/[id]: shipping-profiles fetch failed", err);
          return [];
        })
      : [];

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

  const mode = product.status === "draft" ? "draft" : "edit";

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

      <main>
        <NewProductStepper
          product={product}
          mode={mode}
          featuredSlotsFull={featuredSlotsFull}
          shopMarkupPercent={shopMarkupPercent}
          shopAiImageEnabled={shopAiImageEnabled}
          shopListingFooterEs={settings.listingFooterEs}
          etsyPoliciesConfigured={etsyPoliciesConfigured}
          buyPriceDefaults={buyPriceDefaults}
          imageItems={imageItems}
          videoItems={videoItems}
          aiModels={aiModels}
          aiReferenceImage={
            aiReferenceRow
              ? {
                  url: publicUrlFor(aiReferenceRow.r2Key, R2_PUBLIC_BASE_URL),
                  width: aiReferenceRow.width,
                  height: aiReferenceRow.height,
                }
              : null
          }
          aiGeneratedImage={
            aiModelImageRow
              ? {
                  url: publicUrlFor(aiModelImageRow.r2Key, R2_PUBLIC_BASE_URL),
                  width: aiModelImageRow.width,
                  height: aiModelImageRow.height,
                }
              : null
          }
          shippingProfiles={shippingProfiles}
          shippingMapping={{
            light: oauthRows[0]?.shippingProfileLightId ?? null,
            medium: oauthRows[0]?.shippingProfileMediumId ?? null,
            heavy: oauthRows[0]?.shippingProfileHeavyId ?? null,
          }}
          r2BaseUrl={R2_PUBLIC_BASE_URL}
        />
      </main>
    </>
  );
}
