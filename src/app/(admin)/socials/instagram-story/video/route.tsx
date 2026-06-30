import { ImageResponse } from "next/og";

import { requireSession } from "@/lib/auth/require-session";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";
import { listReadyProductVideos } from "@/lib/products/videos-actions";
import { devGroup } from "@/lib/utils/dev";

import { prepareStoryRender } from "../story-render";
import { composeStoryVideo } from "./compose-story-video";

const log = devGroup("socials-video");

// ffmpeg + on-disk fonts + temp files: Node runtime only.
export const runtime = "nodejs";
// Encoding a ≤30s clip takes a handful of seconds; give the segment room.
export const maxDuration = 120;

/**
 * Renders the Instagram-story chrome as a transparent overlay (same params as
 * the PNG route — `?productId=`, `?variant=`, copy overrides) and composites
 * it over a product video, returning an mp4. `?videoId=` chooses the source
 * video (defaults to the first). The product photo is never drawn — the video
 * is the background — so the render is forced transparent.
 *
 * Failure handling is deliberately loud: every stage logs to container stdout
 * under `[dev:socials-video]`, and a failed compose returns the underlying
 * error text in the 500 body (this is a 2-user internal admin) so it surfaces
 * in the client toast / network tab and can be shared verbatim for debugging.
 */
export async function GET(request: Request) {
  await requireSession();

  const prepared = await prepareStoryRender(request, { forceTransparent: true });
  if (!prepared.ok) return prepared.response;

  const url = new URL(request.url);
  const videoId = url.searchParams.get("videoId");
  const variant = url.searchParams.get("variant") ?? "new";

  const videos = await listReadyProductVideos(prepared.productId);
  if (videos.length === 0) {
    log.warn("no videos for product", prepared.productId);
    return new Response("No videos for this product", { status: 404 });
  }
  const chosen = videos.find((v) => v.id === videoId) ?? videos[0];
  // `listReadyProductVideos` only returns transcoded rows, so r2Key is set.
  const videoUrl = publicUrlFor(chosen.r2Key ?? "", R2_PUBLIC_BASE_URL);

  log.log("request", {
    productId: prepared.productId,
    variant,
    videoId: chosen.id,
    mimeType: chosen.mimeType,
    sizeBytes: chosen.sizeBytes,
    sourceDims: `${chosen.width ?? "?"}x${chosen.height ?? "?"}`,
    durationMs: chosen.durationMs,
  });

  // Rasterize the chrome to a transparent PNG (satori → resvg) and fetch the
  // source video; both feed ffmpeg. Each side is wrapped so a failure names the
  // stage rather than surfacing as an opaque rejection.
  let overlayPng: Buffer;
  let videoBytes: Buffer;
  try {
    [overlayPng, videoBytes] = await Promise.all([
      new ImageResponse(prepared.element, {
        width: prepared.width,
        height: prepared.height,
        fonts: prepared.fonts,
      })
        .arrayBuffer()
        .then((b) => Buffer.from(b)),
      fetch(videoUrl).then(async (res) => {
        if (!res.ok) {
          throw new Error(`video fetch ${res.status} from ${videoUrl}`);
        }
        return Buffer.from(await res.arrayBuffer());
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("input prep failed (overlay raster or video fetch):", err);
    return new Response(`Failed to prepare inputs: ${msg}`, { status: 502 });
  }

  try {
    const mp4 = await composeStoryVideo({
      videoBytes,
      overlayPng,
      width: prepared.width,
      height: prepared.height,
    });

    return new Response(new Uint8Array(mp4), {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("ffmpeg compose failed:", err);
    return new Response(`Video render failed: ${msg}`, { status: 500 });
  }
}
