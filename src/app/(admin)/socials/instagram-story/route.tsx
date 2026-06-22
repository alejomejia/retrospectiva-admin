import { ImageResponse } from "next/og";

import { requireSession } from "@/lib/auth/require-session";

import { prepareStoryRender } from "./story-render";

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
 * `instagram-story-fields.ts`). `?transparent=1` drops the photo + frame
 * background for a transparent overlay PNG.
 */
export async function GET(request: Request) {
  await requireSession();

  const prepared = await prepareStoryRender(request);
  if (!prepared.ok) return prepared.response;

  return new ImageResponse(prepared.element, {
    width: prepared.width,
    height: prepared.height,
    fonts: prepared.fonts,
    headers: { "Cache-Control": "private, no-store" },
  });
}
