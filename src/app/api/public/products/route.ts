import { NextResponse } from "next/server";

import { hasValidPublicApiToken } from "@/lib/auth/public-api-token";
import { getCatalog } from "@/lib/integrations/website/catalog";

/**
 * Public product catalogue for `retrospectiva-website`.
 *
 *   GET /api/public/products
 *   Authorization: Bearer <PUBLIC_API_TOKEN>
 *
 * Returns every visible (published + sold) product as a webhook-shaped
 * payload, plus a `total` (visible) and `available` (in-stock/published)
 * count. The website caches this under the `products` cache tag and the
 * revalidation webhook busts that tag on publish/sold/archive.
 *
 * Excluded from `proxy.ts` session auth; gated by the bearer token only.
 */
export async function GET(req: Request) {
  if (!hasValidPublicApiToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const catalog = await getCatalog();
  return NextResponse.json(catalog);
}
