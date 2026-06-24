import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { devGroup } from "@/lib/utils/dev";

const dev = devGroup("transcode-video");

/**
 * Server-side product-video transcode via the system `ffmpeg` (installed
 * in the image — see Dockerfile). Runs synchronously inside the upload
 * action on temp files under `os.tmpdir()`.
 *
 * Goal: keep near-source quality while cutting file size to a fraction of
 * a phone's 4K/60 original. The recipe:
 *
 *   - Downscale to 1080p (the display ceiling for storefront/Etsy/IG),
 *     never upscaling — `scale=-2:min(1080,ih)` caps height at 1080 and
 *     derives an even width. 4K → 1080p is ~4× fewer pixels, the single
 *     biggest size win, and visually identical on any screen for a
 *     product clip.
 *   - Keep the source frame rate (60fps stays 60fps — smooth motion).
 *   - H.264 (libx264) CRF 21 — constant-quality, so the encoder spends
 *     bits where they matter instead of WhatsApp-style flat-bitrate mush.
 *   - Drop audio (`-an`) — product clips never need sound.
 *   - `+faststart` so the moov atom is at the front for instant web play.
 *   - `yuv420p` for universal decoder/Etsy compatibility.
 *
 * Output is always H.264/MP4 regardless of input container.
 */

/** Output is always MP4/H.264. */
export const TRANSCODED_MIME = "video/mp4";
export const TRANSCODED_EXTENSION = "mp4";

/** Height ceiling — never upscale past the source. */
const MAX_HEIGHT = 1080;
/** libx264 constant-quality factor (lower = better/larger). */
const CRF = "21";

export type TranscodedVideo = {
  /** H.264/MP4 bytes, ready to push to R2. */
  buffer: Buffer;
  /** Output size in bytes. */
  sizeBytes: number;
  /** Output dimensions (computed from the source + 1080p cap). Null when
   *  the source dimensions weren't known. */
  width: number | null;
  height: number | null;
};

/**
 * Transcodes a raw video buffer to a size-optimized 1080p H.264/MP4.
 *
 * @param input - Raw source bytes (any supported container).
 * @param sourceExt - Source file extension (for the temp input name).
 * @param sourceDims - Source pixel dimensions, used to compute the output
 *   size; pass `null`s if unknown (output dims then come back null).
 * @returns The transcoded bytes + their size and dimensions.
 * @throws If ffmpeg exits non-zero (e.g. an undecodable file).
 */
export async function transcodeProductVideo(
  input: Buffer,
  sourceExt: string,
  sourceDims: { width: number | null; height: number | null },
): Promise<TranscodedVideo> {
  const work = await mkdtemp(join(tmpdir(), "product-video-"));
  const inPath = join(work, `in.${sourceExt}`);
  const outPath = join(work, "out.mp4");

  dev.log("transcode start", { inBytes: input.length, sourceDims, work });

  try {
    await writeFile(inPath, input);

    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-an",
      // Comma inside min() is escaped so ffmpeg doesn't read it as a
      // filtergraph separator.
      "-vf",
      "scale=-2:min(1080\\,ih),format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      CRF,
      "-movflags",
      "+faststart",
      outPath,
    ]);

    const buffer = await readFile(outPath);
    const { width, height } = scaledDimensions(sourceDims);
    dev.log("transcode ok", {
      outBytes: buffer.length,
      width,
      height,
    });
    return { buffer, sizeBytes: buffer.length, width, height };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * Computes the output dimensions for the 1080p cap: heights above
 * `MAX_HEIGHT` scale down (width derived, rounded to even for yuv420p);
 * smaller sources pass through untouched. Returns nulls when the source
 * dimensions are unknown.
 */
function scaledDimensions(dims: {
  width: number | null;
  height: number | null;
}): { width: number | null; height: number | null } {
  const { width, height } = dims;
  if (!width || !height) return { width: null, height: null };
  if (height <= MAX_HEIGHT) return { width, height };
  const outHeight = MAX_HEIGHT;
  let outWidth = Math.round((width * MAX_HEIGHT) / height);
  if (outWidth % 2 !== 0) outWidth += 1;
  return { width: outWidth, height: outHeight };
}

/**
 * Spawns ffmpeg, resolving on exit 0 and rejecting with its tail stderr
 * otherwise. Logs the full command so a failure can be reproduced by
 * hand on the box.
 */
function runFfmpeg(args: string[]): Promise<void> {
  dev.log("ffmpeg", ["ffmpeg", ...args].join(" "));
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (err) {
      // e.g. ENOENT — ffmpeg not installed in the image.
      dev.error("ffmpeg spawn failed (is ffmpeg installed?):", err);
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      // Keep the tail — ffmpeg is very chatty; the error is at the end.
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    proc.on("error", (err) => {
      dev.error("ffmpeg process error:", err);
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      dev.error(`ffmpeg exited ${code}. stderr tail:\n${stderr}`);
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}
