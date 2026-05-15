"use client";

import imageCompression from "browser-image-compression";

/**
 * Browser-side image preprocessing for product photos. Runs entirely in
 * the user's browser via the Canvas API — the wire payload, the
 * server's bandwidth, and R2 storage all shrink at once. The Canvas
 * roundtrip also drops EXIF (including GPS), which is a privacy win
 * for vintage photos shot on a personal phone.
 *
 * Output format: JPEG. Etsy's listing-image upload endpoint doesn't
 * accept WebP, so storing JPEG directly avoids a server-side decode +
 * re-encode at publish time. The storage delta vs WebP (~2× at our
 * quality target) is negligible at this scale; the simplicity win is
 * meaningful.
 *
 * HEIC handling: iPhones shoot HEIC by default. `Canvas.drawImage`
 * can't decode HEIC in Chrome / Firefox, so we lazy-load `heic2any`
 * (libheif WASM) to convert HEIC → JPEG blob first, then run the
 * compression pipeline as normal. Loading is lazy so the WASM only
 * ships when someone actually drops a `.heic` file in.
 */

const MAX_DIMENSION_PX = 2400;
/**
 * JPEG quality target. 0.85 gives near-visual-parity with WebP at 0.82
 * for typical product photography (textiles, smooth gradients, mixed
 * colors). Below 0.80 vintage fabric textures start to mush.
 */
const JPEG_QUALITY = 0.85;
const TARGET_FORMAT: ImageMimeType = "image/jpeg";

type ImageMimeType = "image/webp" | "image/jpeg" | "image/png";

export type CompressedImage = {
  /** JPEG-encoded file ready to upload. */
  file: File;
  /** Compressed dimensions. */
  width: number;
  height: number;
};

/**
 * Compresses a single image to a target-size JPEG. Resizes to
 * `MAX_DIMENSION_PX` on the long edge, encodes at `JPEG_QUALITY`,
 * preserves the filename stem but switches the extension to `.jpg`.
 *
 * Throws on:
 * - HEIC files when `heic2any` fails to load (network)
 * - Files the browser can't decode at all (corrupt, exotic formats)
 */
export async function compressImage(input: File): Promise<CompressedImage> {
  const decoded = await decodeHeicIfNeeded(input);

  const compressed = await imageCompression(decoded, {
    maxSizeMB: 2,
    maxWidthOrHeight: MAX_DIMENSION_PX,
    fileType: TARGET_FORMAT,
    initialQuality: JPEG_QUALITY,
    useWebWorker: true,
  });

  // imageCompression returns a Blob typed as File in browsers; ensure
  // the .jpg extension regardless of source filename.
  const baseName = stripExtension(decoded.name);
  const file = new File([compressed], `${baseName}.jpg`, {
    type: TARGET_FORMAT,
    lastModified: Date.now(),
  });

  const { width, height } = await readDimensions(file);
  return { file, width, height };
}

async function decodeHeicIfNeeded(input: File): Promise<File> {
  const looksLikeHeic =
    input.type === "image/heic" ||
    input.type === "image/heif" ||
    /\.heic$/i.test(input.name) ||
    /\.heif$/i.test(input.name);
  if (!looksLikeHeic) return input;

  // Dynamic import keeps the ~150KB libheif WASM out of the initial
  // bundle for users who never upload HEIC.
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: input,
    toType: "image/jpeg",
    quality: 0.95, // High quality for the intermediate; final pass re-encodes.
  });
  const blob = Array.isArray(converted) ? converted[0]! : converted;
  return new File([blob], stripExtension(input.name) + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

async function readDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read compressed image dimensions."));
    };
    img.src = url;
  });
}
