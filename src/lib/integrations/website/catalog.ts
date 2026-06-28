import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

import { buildWebsitePayload, type WebsitePayload } from "./payload-mapper";

const dev = devGroup("website.catalog");

/**
 * Read side of the public store API (`/api/public/products`). Serves the
 * frozen `website_snapshot` each product last pushed to the storefront,
 * so the website sees exactly what the revalidation webhook delivered —
 * and per-field autosave edits stay invisible until an explicit action
 * re-pushes. Visibility is still gated on the LIVE status so a
 * sold/archived transition takes effect immediately on the next webhook.
 *
 * Visibility model (mirrors the storefront):
 *   - `published` → live & purchasable ("available").
 *   - `sold`      → still shown, flagged sold.
 *   - `scheduled` / `draft` / `archived` → not exposed.
 *
 * Read-only; no `server-only` marker so the route handler (and tests)
 * can import it freely.
 */

/** Statuses surfaced on the public storefront, newest first. */
const VISIBLE_STATUSES = ["published", "sold"] as const;

export type CatalogList = {
  /** Every visible product (published + sold). */
  products: WebsitePayload[];
  /** Count of visible products returned. */
  total: number;
  /** Count of `published` (in-stock, purchasable) products. */
  available: number;
};

/**
 * Resolve the payload the storefront should see for one visible product:
 * its frozen `website_snapshot`. Legacy rows published before the
 * snapshot column existed have a null snapshot — we lazily build one from
 * the current columns and persist it, so the next read is a pure
 * snapshot serve. (A never-edited published product's live columns
 * already equal its published state, so the backfill captures the
 * correct payload.) Throws if the product is unbuildable.
 */
async function resolveSnapshot(
  productId: string,
  snapshot: WebsitePayload | null,
): Promise<WebsitePayload> {
  if (snapshot) return snapshot;
  const built = await buildWebsitePayload({ productId, kind: "publish" });
  await db
    .update(products)
    .set({ websiteSnapshot: built })
    .where(eq(products.id, productId));
  dev.warn("catalog: backfilled missing snapshot", productId);
  return built;
}

/**
 * Returns all visible products as their frozen snapshot payloads plus
 * counts. A single malformed/unbuildable row is skipped with a dev
 * warning rather than failing the whole list.
 */
export async function getCatalog(): Promise<CatalogList> {
  const rows = await db
    .select({
      id: products.id,
      status: products.status,
      snapshot: products.websiteSnapshot,
    })
    .from(products)
    .where(inArray(products.status, [...VISIBLE_STATUSES]))
    .orderBy(desc(products.createdAt));

  const settled = await Promise.allSettled(
    rows.map((r) => resolveSnapshot(r.id, r.snapshot)),
  );

  const built: WebsitePayload[] = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      built.push(res.value);
    } else {
      const msg =
        res.reason instanceof Error ? res.reason.message : String(res.reason);
      dev.warn("catalog: skipping product", rows[i]?.id, msg);
    }
  });

  return {
    products: built,
    total: built.length,
    available: built.filter((p) => p.status === "published").length,
  };
}

/**
 * Returns a single visible product by its frozen slug, or `null` when no
 * visible product matches (unpublished/archived slugs resolve to null so
 * the website can 404 cleanly). Serves the frozen snapshot.
 */
export async function getCatalogProductBySlug(
  slug: string,
): Promise<WebsitePayload | null> {
  const [row] = await db
    .select({
      id: products.id,
      status: products.status,
      snapshot: products.websiteSnapshot,
    })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row || !VISIBLE_STATUSES.includes(row.status as never)) return null;

  try {
    return await resolveSnapshot(row.id, row.snapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dev.warn("catalog: product unbuildable", row.id, msg);
    return null;
  }
}
