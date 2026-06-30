"use client";

/**
 * Extracts a poster image from a video file entirely in the browser.
 * Creates a hidden `<video>` element, seeks to a representative frame,
 * paints it to a Canvas, and exports the canvas as a WebP blob — no
 * server-side ffmpeg, no transcoding, no extra dependencies.
 *
 * Also reads duration + dimensions while the video element is loaded,
 * so the caller gets all the metadata it needs in one roundtrip.
 *
 * Returns `poster: null` if the browser can't decode the video (e.g.
 * iPhone HEVC in older Chrome). The video still uploads — the gallery
 * will fall back to the browser's default poster behavior.
 */

export type ExtractedPoster = {
  /** WebP File ready to upload, or null if extraction failed. */
  poster: File | null;
  /** Video duration in ms, or null if `video.duration` was non-finite. */
  durationMs: number | null;
  width: number;
  height: number;
};

const POSTER_QUALITY = 0.82;
const SEEK_TARGET_SECONDS = 1.0;
// Hard ceiling on each browser-decode step. Some files (variable frame
// rate, certain HEVC/MOV, mis-reported duration) load metadata but then
// never fire `loadeddata`/`seeked` — leaving the promise pending forever.
// Without this, `extractVideoPoster` never returns, so `createVideoUpload`
// is never reached and the uploader spinner hangs with zero error client-
// or server-side. On timeout we degrade to no-poster (the video still
// uploads) instead of blocking the whole upload.
const DECODE_STEP_TIMEOUT_MS = 10_000;

export async function extractVideoPoster(input: File): Promise<ExtractedPoster> {
  const url = URL.createObjectURL(input);
  const video = document.createElement("video");
  // muted + playsInline are required by iOS Safari to allow autoplay-
  // style operations on a hidden video element.
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  try {
    await waitForLoadedData(video, url);

    const durationMs = Number.isFinite(video.duration)
      ? Math.round(video.duration * 1000)
      : null;

    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;

    // If the browser couldn't decode dimensions, we still have a usable
    // upload — just no poster. Return early with poster=null.
    if (width === 0 || height === 0) {
      return { poster: null, durationMs, width, height };
    }

    const targetSeconds = Math.min(
      SEEK_TARGET_SECONDS,
      Number.isFinite(video.duration) ? video.duration / 2 : SEEK_TARGET_SECONDS,
    );
    await seekTo(video, targetSeconds);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { poster: null, durationMs, width, height };

    ctx.drawImage(video, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/webp", POSTER_QUALITY);
    if (!blob) return { poster: null, durationMs, width, height };

    const poster = new File([blob], "poster.webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return { poster, durationMs, width, height };
  } catch {
    return { poster: null, durationMs: null, width: 0, height: 0 };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function waitForLoadedData(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("video decode timed out"));
    }, DECODE_STEP_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", onLoad);
      video.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video decode failed"));
    };
    video.addEventListener("loadeddata", onLoad);
    video.addEventListener("error", onError);
    video.src = url;
  });
}

// Resolves on `seeked`, on `error`, OR on timeout — never hangs. A failed
// or slow seek shouldn't sink the upload: we resolve regardless and let the
// caller try to paint whatever frame is current (a bad frame just makes
// drawImage/toBlob fail, which degrades to no-poster, not a hang).
function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(settle, DECODE_STEP_TIMEOUT_MS);
    function settle() {
      clearTimeout(timer);
      video.removeEventListener("seeked", settle);
      video.removeEventListener("error", settle);
      resolve();
    }
    video.addEventListener("seeked", settle);
    video.addEventListener("error", settle);
    video.currentTime = seconds;
  });
}

// `canvas.toBlob` can silently never fire its callback for some inputs /
// codecs — another unbounded await that would hang the whole upload.
// Bound it: on timeout resolve null (→ no-poster, upload still proceeds).
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(blob);
    };
    const timer = setTimeout(() => done(null), DECODE_STEP_TIMEOUT_MS);
    canvas.toBlob((blob) => done(blob), type, quality);
  });
}
