/**
 * Single source of truth for product-media upload limits.
 *
 * Referenced by:
 *   - `src/lib/products/videos-actions.ts` — server-side validation
 *     (defense in depth)
 *   - `src/components/forms/media-uploader.tsx` — client-side
 *     pre-checks BEFORE bytes hit the wire: over-length videos are
 *     rejected, but OVERSIZE videos are auto-trimmed (tail cut, in-
 *     browser ffmpeg.wasm — see `src/lib/utils/trim-video.ts`) to fit
 *     VIDEO_MAX_BYTES, then uploaded
 *   - `src/lib/i18n/messages.es.ts` — error + hint strings interpolate
 *     these values, so changing the limit auto-updates the UI copy
 *   - `next.config.ts` — the proxy/server-action body caps are sized
 *     above VIDEO_MAX_MB with a small multipart-overhead cushion (see
 *     comments in that file)
 *
 * Why 100 MB / 30 s: matches Etsy's hard cap exactly (their listing-
 * video limit is 100 MB and 60 s; we picked 30 s as a tighter shop-
 * level UX choice while keeping size at the Etsy ceiling). At 30 s
 * this fits everything iPhone produces up to 4K / 30fps comfortably;
 * only 4K / 60fps still rejects, which is fine — that resolution is
 * overkill for a product video and the file size is the giveaway.
 */

export const VIDEO_MAX_MB = 100;
export const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;

export const VIDEO_MAX_DURATION_SECONDS = 30;
export const VIDEO_MAX_DURATION_MS = VIDEO_MAX_DURATION_SECONDS * 1000;

export const IMAGE_MAX_MB = 10;
export const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
