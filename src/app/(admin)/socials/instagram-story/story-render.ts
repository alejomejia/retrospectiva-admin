import type { ReactElement } from "react";

import { db } from "@/lib/db/client";
import { etsyOauth } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { resolveStoryFields } from "@/lib/products/instagram-story-fields";
import {
  DEFAULT_VARIANT_KEY,
  isVariantKey,
  variantsForStatus,
} from "@/lib/products/instagram-story-variants";
import { getProduct } from "@/lib/products/actions";
import { listProductImages } from "@/lib/products/images-actions";
import { DEFAULT_MARKUP_PERCENT } from "@/lib/products/pricing";

import { loadStoryFonts, loadStoryLogo, loadStorySeal } from "./load-fonts";
import { STORY_HEIGHT, STORY_WIDTH } from "./story.const";
import { STORY_RENDERERS } from "./templates";

/** Fonts as returned by `loadStoryFonts` (the shape `ImageResponse` wants). */
type StoryFonts = Awaited<ReturnType<typeof loadStoryFonts>>;

/**
 * The satori element + `ImageResponse` options for a story render, resolved
 * from the request's query params. The PNG route turns this straight into an
 * `ImageResponse`; the video route rasterizes it to a transparent overlay and
 * composites it over the product video.
 */
export type PreparedStory =
  | { ok: false; response: Response }
  | {
      ok: true;
      /** The resolved product id (handy for the video route's lookup). */
      productId: string;
      element: ReactElement;
      width: number;
      height: number;
      fonts: StoryFonts;
    };

/**
 * Resolves everything a story render needs from the request: validates the
 * product + template, picks the background photo and copy, loads the shared
 * font/logo/seal assets, and builds the variant's satori element. Returns a
 * ready-to-send error `Response` on any validation failure so the caller can
 * just forward it.
 *
 * `forceTransparent` overrides the `?transparent=` query flag — the video
 * route always needs the chrome on a transparent canvas (the video is the
 * background), regardless of what the client asked for.
 */
export async function prepareStoryRender(
  request: Request,
  { forceTransparent = false }: { forceTransparent?: boolean } = {},
): Promise<PreparedStory> {
  const url = new URL(request.url);
  const id = url.searchParams.get("productId");
  if (!id) {
    return { ok: false, response: new Response("Missing productId", { status: 400 }) };
  }

  const product = await getProduct(id);
  if (!product) {
    return { ok: false, response: new Response("Not found", { status: 404 }) };
  }

  const variant = url.searchParams.get("variant") ?? DEFAULT_VARIANT_KEY;
  if (!isVariantKey(variant)) {
    return { ok: false, response: new Response("Unknown template", { status: 400 }) };
  }
  const eligible = variantsForStatus(product.status).some(
    (v) => v.key === variant,
  );
  if (!eligible) {
    return {
      ok: false,
      response: new Response("Template not available for this product", {
        status: 409,
      }),
    };
  }

  const images = await listProductImages(id);
  if (images.length === 0) {
    return { ok: false, response: new Response("No photos", { status: 404 }) };
  }
  const imageId = url.searchParams.get("imageId");
  // Featured photo (order 0, already first) is the default; fall back to it
  // when the requested id is missing or unknown.
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

  const transparent =
    forceTransparent || url.searchParams.get("transparent") === "1";

  const render = STORY_RENDERERS[variant];
  return {
    ok: true,
    productId: id,
    element: render({ fields, photoUrl, logoUrl, sealUrl, transparent }),
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    fonts,
  };
}
