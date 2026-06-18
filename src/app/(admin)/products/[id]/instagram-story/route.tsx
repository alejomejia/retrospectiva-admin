import { ImageResponse } from "next/og";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { m } from "@/lib/i18n/messages.es";
import { getProduct } from "@/lib/products/actions";
import { listProductImages } from "@/lib/products/images-actions";
import {
  storyEyebrow,
  storyPriceLabel,
} from "@/lib/products/instagram-story";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

import { loadStoryFonts, loadStoryLogo } from "./load-fonts";
import { StoryTemplate } from "./story-template";
import { STORY_HEIGHT, STORY_WIDTH } from "./story-template.const";

// We read vendored font + logo files from disk, so this must run on Node.
export const runtime = "nodejs";

/**
 * Renders the 1080×1920 Instagram-story PNG for a product. Gated on the
 * product being PUBLISHED — only then does the English title (`titleEn`,
 * translated at the publish boundary) exist, and the asset is meant for
 * live listings. Requesting it earlier is a 409 (the client also
 * disables the trigger, but never trust that alone).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) {
    return new Response("Not found", { status: 404 });
  }
  // Server-side gate (mirrors the disabled trigger in the UI).
  if (product.status !== "published") {
    return new Response("Product is not published", { status: 409 });
  }

  const images = await listProductImages(id);
  if (images.length === 0) {
    return new Response("No photos", { status: 404 });
  }
  const url = new URL(request.url);
  const imageId = url.searchParams.get("imageId");
  // Featured photo (order 0, already first) is the default; fall back to
  // it when the requested id is missing or unknown.
  const chosen = images.find((img) => img.id === imageId) ?? images[0];
  const photoUrl = publicUrlFor(chosen.r2Key, R2_PUBLIC_BASE_URL);

  const [oauth] = await db
    .select({ markupPercent: etsyOauth.markupPercent })
    .from(etsyOauth)
    .limit(1);
  const shopMarkupPercent = oauth?.markupPercent ?? DEFAULT_MARKUP_PERCENT;

  const [fonts, logoUrl] = await Promise.all([
    loadStoryFonts(),
    loadStoryLogo(),
  ]);
  // Published products carry the English title (translated at publish);
  // fall back to the Spanish title only defensively.
  const title = product.titleEn?.trim() || product.titleEs?.trim() || "";

  return new ImageResponse(
    (
      <StoryTemplate
        photoUrl={photoUrl}
        eyebrow={storyEyebrow(product)}
        title={title}
        priceLabel={storyPriceLabel(product, shopMarkupPercent)}
        ctaLabel={m.products.instagramStory.ctaEtsy}
        footerHandle={m.products.instagramStory.footerHandle}
        footerTagline={m.products.instagramStory.footerTagline}
        logoUrl={logoUrl}
      />
    ),
    {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      fonts,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
