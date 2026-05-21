import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/lib/db/client";
import { productImages } from "@/lib/db/schema";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { latestRunForKind } from "@/lib/integrations/openai/ai-runs-log";
import { publicUrlFor } from "@/lib/integrations/r2/keys";

/**
 * Status of the per-product on-model image generation (Task 11).
 * Polled by the "Imagen IA" section after the user clicks "Generar
 * imagen" / "Regenerar". Mirrors the shape of `/ai-status` (enrich)
 * + `/generation-status` (Model Studio) so the polling helper can be
 * shared with minor adapter changes.
 *
 * The `image` field is the freshly generated `ai_model`-role image
 * (URL + size) once the run succeeds — saves the client a second
 * fetch to render the preview.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();
  const { id } = await params;

  const [run, image] = await Promise.all([
    latestRunForKind(id, "model_placement"),
    latestAiModelImage(id),
  ]);

  return NextResponse.json({
    run: run
      ? {
          status: run.status,
          error: run.error,
          finishedAt: run.finishedAt?.toISOString() ?? null,
        }
      : null,
    image: image
      ? {
          url: publicUrlFor(image.r2Key, R2_PUBLIC_BASE_URL),
          width: image.width,
          height: image.height,
        }
      : null,
  } satisfies AiImageStatusResponse);
}

async function latestAiModelImage(productId: string) {
  const [row] = await db
    .select({
      r2Key: productImages.r2Key,
      width: productImages.width,
      height: productImages.height,
    })
    .from(productImages)
    .where(
      and(
        eq(productImages.productId, productId),
        eq(productImages.role, "ai_model"),
      ),
    )
    .orderBy(asc(productImages.order))
    .limit(1);
  return row ?? null;
}

export type AiImageStatusResponse = {
  run:
    | {
        status: "pending" | "running" | "succeeded" | "failed";
        error: string | null;
        finishedAt: string | null;
      }
    | null;
  image:
    | { url: string; width: number | null; height: number | null }
    | null;
};
