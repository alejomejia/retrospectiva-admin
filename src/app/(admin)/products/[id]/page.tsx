import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewProductStepper } from "@/components/forms/new-product/new-product-stepper";
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
import { listProductImages } from "@/lib/products/images-actions";
import { listProductVideos } from "@/lib/products/videos-actions";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const [images, videos, oauthRows] = await Promise.all([
    listProductImages(id),
    listProductVideos(id),
    db
      .select({ markupPercent: etsyOauth.markupPercent })
      .from(etsyOauth)
      .limit(1),
  ]);
  const shopMarkupPercent =
    oauthRows[0]?.markupPercent ?? DEFAULT_MARKUP_PERCENT;

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
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-6">
        <Link
          href="/products"
          className="text-caplet inline-flex items-center gap-1.5 hover:text-brand-terracotta"
        >
          <ArrowLeft className="size-3" />
          {m.products.detail.backLink}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-sans text-4xl font-medium tracking-tight">
            {product.titleEs ?? m.products.detail.untitled}
          </h1>
          <Badge
            variant={product.status === "draft" ? "outline" : "default"}
            className="text-caplet"
          >
            {m.products.statuses[product.status]}
          </Badge>
        </div>
      </header>

      {isDraft ? (
        <NewProductStepper
          product={product}
          shopMarkupPercent={shopMarkupPercent}
          imageItems={imageItems}
          videoItems={videoItems}
        />
      ) : (
        <ProductEditForm
          product={product}
          shopMarkupPercent={shopMarkupPercent}
          imageItems={imageItems}
          videoItems={videoItems}
        />
      )}
    </div>
  );
}
