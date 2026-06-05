import { and, count, eq, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

/** Etsy caps shop-wide featured listings at 4. */
export const FEATURED_LISTING_CAP = 4;

/**
 * Count products currently flagged featured, excluding `excludeId`
 * (the product being edited). Used to decide whether the featured
 * toggle should be disabled: once the shop already holds the maximum
 * featured products, no further ones may be flagged.
 *
 * @param excludeId - product id to leave out of the count
 * @returns number of other products with `isFeatured = true`
 */
export async function countOtherFeaturedProducts(
  excludeId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(products)
    .where(and(eq(products.isFeatured, true), ne(products.id, excludeId)));
  return row?.value ?? 0;
}
