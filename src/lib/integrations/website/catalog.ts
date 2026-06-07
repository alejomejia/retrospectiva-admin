import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { devGroup } from "@/lib/utils/dev";

import { buildWebsitePayload, type WebsitePayload } from "./payload-mapper";

const dev = devGroup("website.catalog");

/**
 * Read side of the public store API (`/api/public/products`). Builds the
 * same per-product payload the webhook pushes (via `buildWebsitePayload`)
 * so the website sees one consistent shape whether it pulls the list or
 * reacts to a revalidation webhook.
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
 * Returns all visible products as webhook-shaped payloads plus counts.
 * A single malformed row (missing bilingual copy / listing id) is
 * skipped with a dev warning rather than failing the whole list.
 */
export async function getCatalog(): Promise<CatalogList> {
  const rows = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(inArray(products.status, [...VISIBLE_STATUSES]))
    .orderBy(desc(products.createdAt));

  const settled = await Promise.allSettled(
    rows.map((r) => buildWebsitePayload({ productId: r.id, kind: "publish" })),
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
 * the website can 404 cleanly).
 */
export async function getCatalogProductBySlug(
  slug: string,
): Promise<WebsitePayload | null> {
  const [row] = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row || !VISIBLE_STATUSES.includes(row.status as never)) return null;

  try {
    return await buildWebsitePayload({ productId: row.id, kind: "publish" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dev.warn("catalog: product unbuildable", row.id, msg);
    return null;
  }
}
