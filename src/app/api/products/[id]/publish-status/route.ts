import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { events, products } from "@/lib/db/schema";

/**
 * Publish-status polling endpoint. The client `usePublishSidebar`
 * polls this after enqueuing an `etsy-publish` job to surface a
 * completion / failure toast once the BullMQ worker finishes.
 *
 * Returns the product's current `status` + `etsyListingId` and the
 * most recent `etsy-publish.*` event row so the client can
 * disambiguate "still running" from "completed" from "failed".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const [product] = await db
    .select({
      status: products.status,
      etsyListingId: products.etsyListingId,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [lastEvent] = await db
    .select({ type: events.type, createdAt: events.createdAt })
    .from(events)
    .where(
      and(
        eq(events.productId, id),
        inArray(events.type, [
          "etsy-publish.started",
          "etsy-publish.completed",
          "etsy-publish.skipped",
          "etsy-publish.failed",
        ]),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(1);

  return NextResponse.json({
    status: product.status,
    etsyListingId: product.etsyListingId,
    lastEventType: lastEvent?.type ?? null,
    lastEventAt: lastEvent?.createdAt ?? null,
  });
}
