import { NextResponse } from "next/server";

import { hasValidPublicApiToken } from "@/lib/auth/public-api-token";
import { getCatalogProductBySlug } from "@/lib/integrations/website/catalog";

/**
 * Single public product by its frozen slug, for the website's
 * `/p/[slug]` detail page.
 *
 *   GET /api/public/products/<slug>
 *   Authorization: Bearer <PUBLIC_API_TOKEN>
 *
 * 404s when no visible (published/sold) product matches the slug.
 * Excluded from `proxy.ts` session auth; gated by the bearer token only.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!hasValidPublicApiToken(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(product);
}
