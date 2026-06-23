"use client";

import { VIDEO_MAX_BYTES } from "@/lib/products/media-limits";

/**
 * Browser-side video preprocessing via ffmpeg.wasm, run on every video
 * before it's uploaded. Two stream-copy steps (no re-encode, so quality
 * is untouched and both are near-instant):
 *
 *   1. STRIP AUDIO — product clips never need sound, so the audio track
 *      is always dropped (`-c copy -an`). Besides removing the audio,
 *      this shrinks the file, which can bring an otherwise-oversize clip
 *      back under `VIDEO_MAX_BYTES` and skip step 2 entirely.
 *   2. TRIM TAIL — only if the muted clip is STILL over the cap, cut
 *      seconds off the END until it fits, so a file that would be
 *      rejected by the upload cap can still go through.
 *
 * Everything runs in the browser — the oversize bytes never hit the wire
 * (the whole point of the cap: the server body limit is sized just above
 * it, so it can't receive a larger file).
 *
 * Trim strategy — stream copy, no re-encode:
 *   target = duration × (cap / size) × SAFETY, then `ffmpeg -t target
 *   -c copy`. Copying is near-instant but cuts at the keyframe
 *   at-or-before `target`, so the result always UNDERshoots the
 *   requested duration — and therefore the size. We verify the output
 *   and, in the rare case it's still over (very sparse keyframes), shrink
 *   the target and retry up to MAX_PASSES. The cost is lost footage from
 *   the tail; the caller surfaces how many seconds were dropped.
 *
 * The ~31 MB wasm core is self-hosted at `/ffmpeg/*` (copied from
 * `@ffmpeg/core` by `scripts/copy-ffmpeg-core.mjs`) and loaded lazily.
 */

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

/** Headroom below the cap to absorb container/keyframe rounding. */
const SAFETY = 0.95;
/** Stream-copy undershoots, so a couple of passes covers sparse-keyframe files. */
const MAX_PASSES = 3;

export type ProcessedVideo = {
  /** Audio-stripped (and, if needed, trimmed) file, `≤ VIDEO_MAX_BYTES`. */
  file: File;
  /** Original duration in seconds. */
  originalSeconds: number;
  /** Duration kept after trimming, in seconds (equals original if untrimmed). */
  keptSeconds: number;
  /** Whether the tail was cut to fit the size cap. */
  trimmed: boolean;
};

let loadPromise: Promise<FFmpegInstance> | null = null;

/** Loads + caches a single ffmpeg.wasm instance (self-hosted core). */
async function loadFFmpeg(): Promise<FFmpegInstance> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      // Same-origin classic URLs — no CDN, no cross-origin isolation
      // needed because this is the single-threaded core.
      await ffmpeg.load({
        coreURL: "/ffmpeg/ffmpeg-core.js",
        wasmURL: "/ffmpeg/ffmpeg-core.wasm",
      });
      return ffmpeg;
    })();
  }
  return loadPromise;
}

/**
 * Strips audio from `input` and, if the result is still over
 * `VIDEO_MAX_BYTES`, trims the tail until it fits.
 *
 * Throws if the duration can't be read (without it there's no basis to
 * compute a trim target) — the caller should fall back to rejecting the
 * file with the normal "too large" message.
 */
export async function prepareVideoForUpload(
  input: File,
): Promise<ProcessedVideo> {
  const originalSeconds = await readDurationSeconds(input);

  const ext = extensionOf(input);
  const inName = `in.${ext}`;
  const mutedName = `muted.${ext}`;
  const outName = `out.${ext}`;
  const mp4Like = ext === "mp4" || ext === "mov";

  const ffmpeg = await loadFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(inName, await fetchFile(input));

  try {
    // STEP 1 — drop the audio track (stream copy, no re-encode).
    await ffmpeg.exec([
      "-i",
      inName,
      "-an",
      "-c",
      "copy",
      ...(mp4Like ? ["-movflags", "+faststart"] : []),
      "-y",
      mutedName,
    ]);
    const muted = await readToFile(ffmpeg, mutedName, input, ext);

    // Audio strip alone may have brought it under the cap — no trim needed.
    if (muted.size <= VIDEO_MAX_BYTES) {
      return {
        file: muted.file,
        originalSeconds,
        keptSeconds: originalSeconds,
        trimmed: false,
      };
    }

    // STEP 2 — still over: trim the tail off the muted clip. The bitrate
    // estimate uses the muted size, so it accounts for the audio already
    // being gone.
    let target = (originalSeconds * VIDEO_MAX_BYTES * SAFETY) / muted.size;
    let result: { file: File; size: number; seconds: number } | null = null;

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      target = Math.max(1, target);
      await ffmpeg.exec([
        "-ss",
        "0",
        "-i",
        mutedName,
        "-t",
        target.toFixed(3),
        "-c",
        "copy",
        ...(mp4Like ? ["-movflags", "+faststart"] : []),
        "-y",
        outName,
      ]);

      const out = await readToFile(ffmpeg, outName, input, ext);
      result = { file: out.file, size: out.size, seconds: target };

      if (out.size <= VIDEO_MAX_BYTES) break;

      // Still over (sparse keyframes / bitrate spike near the cut):
      // scale the target down by the overshoot ratio and try again.
      target = (target * VIDEO_MAX_BYTES * SAFETY) / out.size;
    }

    if (!result || result.size > VIDEO_MAX_BYTES) {
      throw new Error("could not trim video under size limit");
    }

    return {
      file: result.file,
      originalSeconds,
      // Report the actual kept duration (copy undershoots the target),
      // capped at the original so rounding never reads as "longer".
      keptSeconds: Math.min(originalSeconds, result.seconds),
      trimmed: true,
    };
  } finally {
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(mutedName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
}

/** Reads an ffmpeg output file into a renamed, upload-ready `File`. */
async function readToFile(
  ffmpeg: FFmpegInstance,
  name: string,
  input: File,
  ext: string,
): Promise<{ file: File; size: number }> {
  const data = (await ffmpeg.readFile(name)) as Uint8Array;
  // Copy into a fresh ArrayBuffer-backed view: ffmpeg's buffer may be
  // SharedArrayBuffer-typed, which isn't a valid BlobPart in TS.
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes], { type: input.type || "video/mp4" });
  const file = new File([blob], renameProcessed(input.name, ext), {
    type: blob.type,
    lastModified: Date.now(),
  });
  return { file, size: file.size };
}

/** Reads a video's duration (seconds) via a hidden metadata load. */
function readDurationSeconds(input: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      const d = video.duration;
      cleanup();
      if (Number.isFinite(d) && d > 0) resolve(d);
      else reject(new Error("unreadable video duration"));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("unreadable video duration"));
    };
    video.src = url;
  });
}

function extensionOf(file: File): string {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = m?.[1]?.toLowerCase();
  if (ext === "mov" || ext === "webm") return ext;
  // Default everything else (incl. quicktime mislabels) to mp4, which is
  // the right container for the h264/aac streams iPhones produce.
  return "mp4";
}

function renameProcessed(name: string, ext: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return `${stem}-processed.${ext}`;
}
