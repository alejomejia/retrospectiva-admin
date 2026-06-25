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
 *   - Cap the SHORTER edge at 1080, never upscaling. Phone clips are
 *     portrait, so the long edge is the height — capping that (the old
 *     `scale=-2:min(1080,ih)`) shrank a 1080×1920 clip to 608×1080, which
 *     the 1080×1920 IG-story compose then upscaled back to mush. Capping
 *     the short edge keeps portrait at 1080×1920 (matching the story
 *     canvas) while still taking 4K landscape down to 1920×1080.
 *   - Keep the source frame rate (60fps stays 60fps — smooth motion).
 *   - H.264 (libx264) CRF 21 — constant-quality, so the encoder spends
 *     bits where they matter instead of WhatsApp-style flat-bitrate mush.
 *   - Drop audio (`-an`) — product clips never need sound.
 *   - `+faststart` so the moov atom is at the front for instant web play.
 *   - Colour-correct to SDR BT.709 + tag the output. iPhones shoot HDR
 *     (HLG/PQ, BT.2020) by default; a plain `format=yuv420p` reinterprets
 *     those HDR values as SDR and leaves the output untagged → washed-out,
 *     shifted colour. We ffprobe the transfer function and, for HDR
 *     sources, tone-map to BT.709 via zscale (present in the Alpine ffmpeg
 *     build); SDR sources just get tagged. Output is always BT.709.
 *
 * Output is always H.264/MP4 regardless of input container.
 */

/** Output is always MP4/H.264. */
export const TRANSCODED_MIME = "video/mp4";
export const TRANSCODED_EXTENSION = "mp4";

/** Shorter-edge ceiling — never upscale past the source. */
const MAX_SHORT_EDGE = 1080;
/** libx264 constant-quality factor (lower = better/larger). */
const CRF = "21";

/** HDR transfer functions that need tone-mapping down to SDR BT.709. */
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);

/**
 * Caps the shorter edge at `MAX_SHORT_EDGE` and derives the other edge
 * (even, for yuv420p), never upscaling. Branches on orientation so the
 * cap always lands on the short side regardless of portrait/landscape.
 */
// The single quotes round each expression protect the commas from the
// filtergraph parser, so no backslash escaping is needed inside them.
const SCALE_FILTER =
  "scale=" +
  "w='if(gt(iw,ih),-2,min(" + MAX_SHORT_EDGE + ",iw))':" +
  "h='if(gt(iw,ih),min(" + MAX_SHORT_EDGE + ",ih),-2)'";

/**
 * Tone-maps an HDR (BT.2020 PQ/HLG) source down to SDR BT.709 on linear
 * light. zscale ships in the Alpine ffmpeg build (see Dockerfile).
 */
const HDR_TO_SDR_FILTER =
  "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709," +
  "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv";

/**
 * Tags the output SDR BT.709 so players stop guessing. The `-color_*`
 * flags write the MP4 `colr` atom; `-x264-params` writes the matching VUI
 * into the H.264 bitstream itself (the muxer flags alone don't reliably
 * set all three on every ffmpeg build — only the VUI does).
 */
const BT709_OUTPUT_FLAGS = [
  "-color_primaries", "bt709",
  "-color_trc", "bt709",
  "-colorspace", "bt709",
  "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709",
];

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

    // Probe the source transfer function so HDR clips get tone-mapped and
    // SDR clips skip the (lossy, slower) tonemap chain. A failed/unknown
    // probe falls back to the SDR path — safe for the BT.709 phone norm.
    const isHdr = await probeIsHdr(inPath);
    const filters = isHdr
      ? `${SCALE_FILTER},${HDR_TO_SDR_FILTER},format=yuv420p`
      : `${SCALE_FILTER},format=yuv420p`;
    dev.log("transcode filters", { isHdr });

    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-an",
      "-vf",
      filters,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      CRF,
      ...BT709_OUTPUT_FLAGS,
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
 * Computes the output dimensions for the shorter-edge cap: when the short
 * edge exceeds `MAX_SHORT_EDGE` both edges scale down by the same factor
 * (the long edge rounded to even for yuv420p); smaller sources pass
 * through untouched. Mirrors `SCALE_FILTER`. Returns nulls when the
 * source dimensions are unknown.
 */
function scaledDimensions(dims: {
  width: number | null;
  height: number | null;
}): { width: number | null; height: number | null } {
  const { width, height } = dims;
  if (!width || !height) return { width: null, height: null };
  const shortEdge = Math.min(width, height);
  if (shortEdge <= MAX_SHORT_EDGE) return { width, height };
  const scale = MAX_SHORT_EDGE / shortEdge;
  const roundEven = (n: number) => {
    const r = Math.round(n);
    return r % 2 === 0 ? r : r + 1;
  };
  return {
    width: width === shortEdge ? MAX_SHORT_EDGE : roundEven(width * scale),
    height: height === shortEdge ? MAX_SHORT_EDGE : roundEven(height * scale),
  };
}

/**
 * Returns whether the source's video transfer characteristics are HDR
 * (PQ/HLG) via `ffprobe`. Resolves `false` on any probe failure so the
 * caller falls back to the SDR path rather than aborting the upload.
 */
function probeIsHdr(inPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(
        "ffprobe",
        [
          "-v", "error",
          "-select_streams", "v:0",
          "-show_entries", "stream=color_transfer",
          "-of", "default=nw=1:nk=1",
          inPath,
        ],
        { stdio: ["ignore", "pipe", "ignore"] },
      );
    } catch (err) {
      dev.error("ffprobe spawn failed (assuming SDR):", err);
      resolve(false);
      return;
    }
    let out = "";
    proc.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    proc.on("error", () => resolve(false));
    proc.on("close", () => resolve(HDR_TRANSFERS.has(out.trim())));
  });
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
