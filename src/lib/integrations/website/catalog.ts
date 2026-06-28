import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

import { buildWebsitePayload, type WebsitePayload } from "./payload-mapper";

const dev = devGroup("website.catalog");

/**
 * Read side of the public store API (`/api/public/products`). Serves the
 * frozen `website_snapshot` each product last pushed to the storefront
 * for all CONTENT (title/description/price/images/…), so per-field
 * autosave edits stay invisible until an explicit action re-pushes.
 *
 * Publish METADATA (`status`, `published_at`, `sold_at`) is read LIVE from
 * the row and overlaid on the snapshot — these only change through
 * explicit publish/sold/archive actions (never autosave), so reading them
 * live is safe AND avoids a subtle staleness bug: ordering + the NEW
 * badge key off `published_at`, and if they were frozen in the snapshot a
 * publish/backfill wouldn't take effect until every snapshot was rebuilt.
 * Visibility is likewise gated on the LIVE status.
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

/** Live publish metadata overlaid onto a served snapshot. */
type LiveMeta = {
  status: WebsitePayload["status"];
  publishedAt: Date | null;
  soldAt: Date | null;
  createdAt: Date;
};

/**
 * Overlay live publish metadata onto the frozen snapshot. Mirrors the
 * `publishedAt` rule in `payload-mapper` (non-null only while published,
 * fallback to creation date) but sourced from the LIVE row so order +
 * NEW-badge reflect the current `published_at` without a snapshot rebuild.
 */
function withLiveMeta(snapshot: WebsitePayload, meta: LiveMeta): WebsitePayload {
  return {
    ...snapshot,
    status: meta.status,
    publishedAt:
      meta.status === "published"
        ? (meta.publishedAt ?? meta.createdAt).toISOString()
        : null,
    soldAt: meta.soldAt ? meta.soldAt.toISOString() : null,
  };
}

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
 * Returns all visible products as their frozen snapshot payloads (with
 * live publish metadata overlaid) plus counts, ordered newest-published
 * first by the LIVE `published_at`. A single malformed/unbuildable row is
 * skipped with a dev warning rather than failing the whole list.
 */
export async function getCatalog(): Promise<CatalogList> {
  const rows = await db
    .select({
      id: products.id,
      status: products.status,
      publishedAt: products.publishedAt,
      soldAt: products.soldAt,
      createdAt: products.createdAt,
      snapshot: products.websiteSnapshot,
    })
    .from(products)
    .where(inArray(products.status, [...VISIBLE_STATUSES]))
    // Newest-published first. `published_at` is null only transiently
    // (pre-backfill); push those last, then break ties by creation date.
    .orderBy(
      sql`${products.publishedAt} desc nulls last`,
      desc(products.createdAt),
    );

  const settled = await Promise.allSettled(
    rows.map(async (r) => withLiveMeta(await resolveSnapshot(r.id, r.snapshot), r)),
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
 * the website can 404 cleanly). Serves the frozen snapshot with live
 * publish metadata overlaid.
 */
export async function getCatalogProductBySlug(
  slug: string,
): Promise<WebsitePayload | null> {
  const [row] = await db
    .select({
      id: products.id,
      status: products.status,
      publishedAt: products.publishedAt,
      soldAt: products.soldAt,
      createdAt: products.createdAt,
      snapshot: products.websiteSnapshot,
    })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row || !VISIBLE_STATUSES.includes(row.status as never)) return null;

  try {
    return withLiveMeta(await resolveSnapshot(row.id, row.snapshot), row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dev.warn("catalog: product unbuildable", row.id, msg);
    return null;
  }
}
