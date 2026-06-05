import { redirect } from "next/navigation";

import { createDraftProduct } from "@/lib/products/actions";

/**
 * GET /products/new
 *
 * Auto-creates a placeholder draft and redirects to its detail page in
 * edit mode (`?new=1`). The user lands on the same unified edit + media
 * UI whether they're creating a new product or editing an existing one
 * — no separate "fill the form first, then add photos" step.
 *
 * Auth is enforced upstream by `proxy.ts`. The placeholder name and
 * priceCents=0 are non-validating values that the user will overwrite
 * on first save (validation kicks in via `updateProduct`).
 *
 * Route handler (not a page) because the work is pure side-effect +
 * navigation — no UI to render.
 */
export async function GET(request: Request) {
  // NOTE: `<Link href="/products/new">` is auto-prefetched by the Next
  // router on every render of the products list. Prefetch issues a real
  // GET, which would create a phantom draft on each page load. Bail out
  // for prefetch requests so drafts are only created on real navigation.
  const isPrefetch =
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) {
    return new Response(null, { status: 204 });
  }

  const { id } = await createDraftProduct();
  redirect(`/products/${id}?new=1`);
}
