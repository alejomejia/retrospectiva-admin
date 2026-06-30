import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { productVideos } from "@/lib/db/schema";

/**
 * Transcode status for a product's videos. Polled by the `VideoList`
 * while any row is still `processing` (the browser uploaded the raw clip
 * to R2 and the worker is transcoding). The list re-fetches the page once
 * a status flips so the finished `<video>` swaps in. Mirrors the shape of
 * `ai-image-status` so the polling hooks stay siblings.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const rows = await db
    .select({
      id: productVideos.id,
      status: productVideos.status,
      error: productVideos.error,
    })
    .from(productVideos)
    .where(eq(productVideos.productId, id))
    .orderBy(asc(productVideos.order));

  return NextResponse.json({ videos: rows } satisfies VideosStatusResponse);
}

export type VideosStatusResponse = {
  videos: {
    id: string;
    status: "processing" | "ready" | "failed";
    error: string | null;
  }[];
};
