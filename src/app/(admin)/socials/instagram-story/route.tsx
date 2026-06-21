import { ImageResponse } from "next/og";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { getProduct } from "@/lib/products/actions";
import { listProductImages } from "@/lib/products/images-actions";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

import { resolveStoryFields } from "@/lib/products/instagram-story-fields";
import {
  DEFAULT_VARIANT_KEY,
  isVariantKey,
  variantsForStatus,
} from "@/lib/products/instagram-story-variants";

import { loadStoryFonts, loadStoryLogo, loadStorySeal } from "./load-fonts";
import { STORY_HEIGHT, STORY_WIDTH } from "./story.const";
import { STORY_RENDERERS } from "./templates";

// We read vendored font + logo files from disk, so this must run on Node.
export const runtime = "nodejs";

/**
 * Renders a 1080×1920 Instagram-story PNG for a product. The product is
 * identified by `?productId=` and the template by `?variant=` (default
 * `new`). Each template declares which product statuses it applies to
 * (`variants.ts`); requesting one the product isn't eligible for is a 409
 * (the studio also gates this, but never trust the client alone).
 * `?imageId=` chooses the background photo; per-field `?<key>=` params
 * override the template copy (defaults computed from the product — see
 * `instagram-story-fields.ts`).
 */
export async function GET(request: Request) {
  await requireSession();

  const url = new URL(request.url);
  const id = url.searchParams.get("productId");
  if (!id) {
    return new Response("Missing productId", { status: 400 });
  }

  const product = await getProduct(id);
  if (!product) {
    return new Response("Not found", { status: 404 });
  }

  const variant = url.searchParams.get("variant") ?? DEFAULT_VARIANT_KEY;
  if (!isVariantKey(variant)) {
    return new Response("Unknown template", { status: 400 });
  }
  const eligible = variantsForStatus(product.status).some(
    (v) => v.key === variant,
  );
  if (!eligible) {
    return new Response("Template not available for this product", {
      status: 409,
    });
  }

  const images = await listProductImages(id);
  if (images.length === 0) {
    return new Response("No photos", { status: 404 });
  }
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

  // Shared assets, module-cached, so loading the seal for every variant
  // (only `sold` draws it) costs one disk read total.
  const [fonts, logoUrl, sealUrl] = await Promise.all([
    loadStoryFonts(),
    loadStoryLogo(),
    loadStorySeal(),
  ]);

  const fields = resolveStoryFields(
    variant,
    product,
    shopMarkupPercent,
    url.searchParams,
  );

  const render = STORY_RENDERERS[variant];
  return new ImageResponse(
    render({ fields, photoUrl, logoUrl, sealUrl }),
    {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      fonts,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
