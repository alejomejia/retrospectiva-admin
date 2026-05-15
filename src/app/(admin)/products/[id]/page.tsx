import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MediaUploader } from "@/components/forms/media-uploader";
import { ImageList, type ImageListItem } from "@/components/products/image-list";
import { ProductDetailsCard } from "@/components/products/product-details-card";
import { VideoList, type VideoListItem } from "@/components/products/video-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import { getProduct } from "@/lib/products/actions";
import { listProductImages } from "@/lib/products/images-actions";
import { listProductVideos } from "@/lib/products/videos-actions";

/**
 * Phase 3 detail view: editable product fields + photo + video manager.
 * Phase 4 adds the Etsy publish action, Phase 6 wires the AI panel.
 */
export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // `?new=1` is set when the user is bounced here right after auto-
  // creating a draft via /products/new. Opens the details card in edit
  // mode so the placeholder name + 0 EUR are immediately replaceable.
  const startInEditMode = sp.new === "1";

  const product = await getProduct(id);
  if (!product) notFound();

  const [images, videos] = await Promise.all([
    listProductImages(id),
    listProductVideos(id),
  ]);
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
            {product.name}
          </h1>
          <Badge
            variant={product.status === "draft" ? "outline" : "default"}
            className="text-caplet"
          >
            {m.products.statuses[product.status]}
          </Badge>
        </div>
      </header>

      <ProductDetailsCard
        product={product}
        startInEditMode={startInEditMode}
      />

      <Card>
        <CardHeader>
          <CardTitle>{m.products.detail.mediaTitle}</CardTitle>
          <CardDescription>
            {m.products.detail.mediaDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <MediaUploader productId={product.id} />

          <section className="space-y-3">
            <h3 className="text-caplet">
              {m.products.detail.photosTitle}
              {imageItems.length > 0 ? ` · ${imageItems.length}` : ""}
            </h3>
            <ImageList images={imageItems} />
          </section>

          <section className="space-y-3">
            <h3 className="text-caplet">
              {m.products.detail.videosTitle}
              {videoItems.length > 0 ? ` · ${videoItems.length}` : ""}
            </h3>
            <VideoList videos={videoItems} />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
