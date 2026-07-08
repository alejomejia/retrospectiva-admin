/**
 * Single source of truth for product-media upload limits.
 *
 * Referenced by:
 *   - `src/lib/products/videos-actions.ts` — server-side validation
 *     (defense in depth)
 *   - `src/components/forms/media-uploader.tsx` — client-side
 *     pre-checks BEFORE bytes hit the wire: videos over the duration
 *     cap or over `VIDEO_SOURCE_MAX_BYTES` are rejected; anything that
 *     passes is uploaded RAW directly to R2 (presigned PUT — the app
 *     server never sees it) and transcoded in the worker
 *     (`src/lib/products/transcode-worker.ts`) to a 1080p H.264/MP4
 *     well under `VIDEO_MAX_BYTES`
 *   - `src/lib/i18n/messages.en.ts` — error + hint strings interpolate
 *     these values, so changing the limit auto-updates the UI copy
 *   - `src/lib/products/videos-actions.ts` — `createVideoUpload`
 *     enforces `VIDEO_SOURCE_MAX_BYTES` before minting the presigned URL
 *
 * Two size limits, because raw and final are now different files:
 *
 *   - VIDEO_SOURCE_MAX_MB (400) — the raw upload cap. A 30 s 4K/60 phone
 *     clip is ~150-350 MB; this leaves room to accept it for transcode.
 *     Enforced client-side and in `createVideoUpload`; the bytes go
 *     straight to R2 via presigned PUT, never through the app server.
 *   - VIDEO_MAX_MB (100) — the FINAL (transcoded) ceiling, matching
 *     Etsy's hard cap exactly (their listing-video limit is 100 MB /
 *     60 s; we picked 30 s as a tighter shop-level UX choice). The
 *     1080p CRF-21 transcode lands far below this, but it stays as the
 *     output sanity bound.
 */

export const VIDEO_MAX_MB = 100;
export const VIDEO_MAX_BYTES = VIDEO_MAX_MB * 1024 * 1024;

export const VIDEO_SOURCE_MAX_MB = 400;
export const VIDEO_SOURCE_MAX_BYTES = VIDEO_SOURCE_MAX_MB * 1024 * 1024;

export const VIDEO_MAX_DURATION_SECONDS = 30;
export const VIDEO_MAX_DURATION_MS = VIDEO_MAX_DURATION_SECONDS * 1000;

export const IMAGE_MAX_MB = 10;
export const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024;
