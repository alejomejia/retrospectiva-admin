import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { devGroup } from "@/lib/utils/dev";

const log = devGroup("socials-video");

/**
 * Composites the (transparent) story chrome over a product video and returns
 * the encoded mp4 bytes.
 *
 * The video is cover-cropped to the story canvas (scale-to-fill + centre crop,
 * matching how the photo background uses `objectFit: cover`), the overlay PNG
 * is laid on top for the full duration, and audio is dropped. Runs the
 * system `ffmpeg` (installed in the image) on temp files under `os.tmpdir()`,
 * which are always cleaned up.
 *
 * Inline/synchronous by design: product videos are capped at 30s / 100MB
 * (`media-limits.ts`), so a `veryfast` libx264 pass finishes within a request
 * for a single-admin tool.
 */
export async function composeStoryVideo({
  videoBytes,
  overlayPng,
  width,
  height,
}: {
  /** The source product video file. */
  videoBytes: Buffer;
  /** The rasterized story chrome — a transparent PNG at `width`×`height`. */
  overlayPng: Buffer;
  width: number;
  height: number;
}): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "story-video-"));
  const videoPath = join(dir, "in");
  const overlayPath = join(dir, "overlay.png");
  const outPath = join(dir, "out.mp4");

  log.log("compose start", {
    videoBytes: videoBytes.length,
    overlayBytes: overlayPng.length,
    width,
    height,
    dir,
  });

  try {
    await Promise.all([
      writeFile(videoPath, videoBytes),
      writeFile(overlayPath, overlayPng),
    ]);

    // Cover-crop the video to the canvas, then overlay the single PNG frame.
    // `overlay=...:eof_action=repeat` holds that one frame for the whole clip,
    // so the output length tracks the (finite) video naturally — no `-loop`/
    // `-shortest`, which let the infinite image input run the encode away.
    await runFfmpeg([
      "-y",
      "-i", videoPath,
      "-i", overlayPath,
      "-filter_complex",
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1[bg];` +
        `[bg][1:v]overlay=0:0:eof_action=repeat,format=yuv420p[v]`,
      "-map", "[v]",
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      // Colour tags (container colr atom + matching H.264 VUI) so colour-
      // managed players don't guess. The brand-coloured story chrome is
      // authored in sRGB (CSS), so the transfer is tagged sRGB
      // (iec61966-2-1), NOT bt709 — otherwise macOS QuickTime/Preview/
      // Safari apply the bt709 gamma and shift the overlay's tones away
      // from how it looks in the browser. Primaries + matrix stay bt709
      // (sRGB shares bt709 primaries); the product video underneath is
      // true bt709 but its photographic content is imperceptibly affected
      // by the sRGB transfer, whereas the flat overlay colours are not.
      "-color_primaries", "bt709",
      "-color_trc", "iec61966-2-1",
      "-colorspace", "bt709",
      "-x264-params",
      "colorprim=bt709:transfer=iec61966-2-1:colormatrix=bt709",
      "-movflags", "+faststart",
      outPath,
    ]);

    const mp4 = await readFile(outPath);
    log.log("compose ok", { outBytes: mp4.length });
    return mp4;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Spawns ffmpeg, resolving on exit 0 and rejecting with its tail stderr
 * otherwise. Logs the full command (so a failure can be reproduced by hand on
 * the box) and, on failure, the captured stderr — both via `[dev:socials-video]`
 * to container stdout.
 */
function runFfmpeg(args: string[]): Promise<void> {
  log.log("ffmpeg", ["ffmpeg", ...args].join(" "));
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch (err) {
      // e.g. ENOENT — ffmpeg not installed in the image.
      log.error("ffmpeg spawn failed (is ffmpeg installed?):", err);
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      // Keep the tail — ffmpeg is very chatty; the error is at the end.
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    proc.on("error", (err) => {
      log.error("ffmpeg process error:", err);
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      log.error(`ffmpeg exited ${code}. stderr tail:\n${stderr}`);
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}
