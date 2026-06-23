"use client";

import { VIDEO_MAX_BYTES } from "@/lib/products/media-limits";

/**
 * Browser-side video trimming via ffmpeg.wasm. Cuts seconds off the END
 * of an oversize clip until it fits under `VIDEO_MAX_BYTES`, so a file
 * that would otherwise be rejected by the upload cap can still go
 * through. Runs entirely in the browser — the oversize bytes never hit
 * the wire (which is the whole point of the cap: the server body limit
 * is sized just above the cap, so it can't receive a larger file).
 *
 * Strategy — stream copy, no re-encode:
 *   target = duration × (cap / size) × SAFETY, then `ffmpeg -t target
 *   -c copy`. Copying is near-instant (no transcode) but cuts at the
 *   keyframe at-or-before `target`, so the result always UNDERshoots
 *   the requested duration — and therefore the size. We verify the
 *   output and, in the rare case it's still over (very sparse
 *   keyframes), shrink the target and retry up to MAX_PASSES.
 *
 * Quality is untouched (no re-encode); the cost is lost footage from
 * the tail. The caller surfaces how many seconds were dropped.
 *
 * The ~31 MB wasm core is self-hosted at `/ffmpeg/*` (copied from
 * `@ffmpeg/core` by `scripts/copy-ffmpeg-core.mjs`) and loaded lazily,
 * so it only ships to a user who actually drops an oversize video.
 */

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;

/** Headroom below the cap to absorb container/keyframe rounding. */
const SAFETY = 0.95;
/** Stream-copy undershoots, so a couple of passes covers sparse-keyframe files. */
const MAX_PASSES = 3;

export type TrimmedVideo = {
  /** Trimmed file, guaranteed `≤ VIDEO_MAX_BYTES`. */
  file: File;
  /** Original duration in seconds. */
  originalSeconds: number;
  /** Duration kept after trimming, in seconds. */
  keptSeconds: number;
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
 * Trims `input` to fit under `VIDEO_MAX_BYTES` by cutting from the end.
 *
 * Throws if the duration can't be read (without it there's no basis to
 * compute a target) — the caller should fall back to rejecting the file
 * with the normal "too large" message.
 */
export async function trimVideoToFit(input: File): Promise<TrimmedVideo> {
  const originalSeconds = await readDurationSeconds(input);

  const ext = extensionOf(input);
  const inName = `in.${ext}`;
  const outName = `out.${ext}`;
  const mp4Like = ext === "mp4" || ext === "mov";

  const ffmpeg = await loadFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile(inName, await fetchFile(input));

  try {
    // First estimate assumes ~constant bitrate.
    let target = (originalSeconds * VIDEO_MAX_BYTES * SAFETY) / input.size;
    let result: { file: File; size: number; seconds: number } | null = null;

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      target = Math.max(1, target);
      const args = [
        "-ss",
        "0",
        "-i",
        inName,
        "-t",
        target.toFixed(3),
        "-c",
        "copy",
        ...(mp4Like ? ["-movflags", "+faststart"] : []),
        "-y",
        outName,
      ];
      await ffmpeg.exec(args);

      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      // Copy into a fresh ArrayBuffer-backed view: ffmpeg's buffer may be
      // SharedArrayBuffer-typed, which isn't a valid BlobPart in TS.
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(data);
      const blob = new Blob([bytes], { type: input.type || "video/mp4" });
      const file = new File([blob], renameTrimmed(input.name, ext), {
        type: blob.type,
        lastModified: Date.now(),
      });
      result = { file, size: file.size, seconds: target };

      if (file.size <= VIDEO_MAX_BYTES) break;

      // Still over (sparse keyframes / bitrate spike near the cut):
      // scale the target down by the overshoot ratio and try again.
      target = (target * VIDEO_MAX_BYTES * SAFETY) / file.size;
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
    };
  } finally {
    await ffmpeg.deleteFile(inName).catch(() => {});
    await ffmpeg.deleteFile(outName).catch(() => {});
  }
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

function renameTrimmed(name: string, ext: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  return `${stem}-trimmed.${ext}`;
}
