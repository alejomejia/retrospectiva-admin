# Media handling — images and videos

How product photos and videos flow from the user's drag-and-drop to
Cloudflare R2, and how each format is processed differently along the
way.

## The big picture

```
browser drops a file
       │
       ▼
MediaUploader (client component)
       │ dispatches by MIME type
       │
   ┌───┴───────────────────────────────────┐
   │                                       │
   ▼ image/*                               ▼ video/*
compressImage (browser)               extractVideoPoster (browser)
  - HEIC → JPEG (lazy heic2any)         - <video> + Canvas @ 1s
  - resize to max 2400px wide           - duration + dimensions read
  - encode to JPEG @ q=0.85             - WebP poster output
  - EXIF strip (Canvas roundtrip)       - no transcoding
   │                                       │
   ▼                                       ▼
uploadProductImage                    uploadProductVideo
  ├─ server-side size cap (10 MB)       ├─ server-side size cap (100 MB)
  ├─ MIME allowlist                     ├─ duration cap (30 s)
  ├─ uuid + R2 key                      ├─ MIME allowlist
  ├─ PutObject to R2                    ├─ uuid + R2 key (video + poster)
  ├─ INSERT product_images               ├─ PutObject ×2 (video + poster)
  └─ INSERT events "image.uploaded"     ├─ INSERT product_videos
                                        └─ INSERT events "video.uploaded"
```

The two pipelines are intentionally **separate at the data layer** —
images live in `product_images`, videos live in `product_videos`,
with different columns suited to each. The pipelines are **merged at
the UI** so the user only sees one drop target.

## Images

### Pipeline

1. **Decode HEIC if needed** (`compress-image.ts` → `decodeHeicIfNeeded`).
   iPhone's default format. Lazy-imports `heic2any` so the ~150 KB
   WASM only ships when an actual `.heic` file is dropped. Mac
   AirDrop / iCloud auto-convert to JPEG; raw iPhone Safari uploads
   keep HEIC.
2. **Resize + re-encode** via `browser-image-compression`:
   - Max dimension: **2400px** on the long edge
   - Quality: **0.85** JPEG
   - `maxSizeMB: 2` target (best effort, not strict)
   - Uses a Web Worker so the main thread stays responsive
3. **EXIF strip** happens for free — the Canvas roundtrip doesn't
   preserve metadata. Privacy win for vintage photos that may carry
   GPS coords from when the seller photographed them.
4. **Server upload** via `uploadProductImage` server action. The
   server re-validates size + MIME + product existence.

### Why JPEG, not WebP

This was a deliberate switch. Background:

- WebP gives ~50% smaller files than JPEG at equivalent quality.
- **But Etsy's listing-image upload endpoint doesn't accept WebP** —
  see [etsy-listing-payload.md §4](./etsy-listing-payload.md). Sending
  a WebP gets rejected at publish time.

Two options:
1. Store WebP in R2, decode+re-encode to JPEG at publish time.
2. Store JPEG directly. Skip the conversion.

The storage delta (~2× WebP at our quality target, ~250 KB JPEG vs
~125 KB WebP per 2400px photo) is negligible at our scale — for 100
products × 5 photos, that's 125 MB vs 60 MB, costing pennies on R2.
Not worth the complexity at the Etsy boundary.

**Decision: JPEG from the start.** Quality bumped to 0.85 (up from
WebP's 0.82) to compensate for JPEG's lower efficiency — vintage
fabric textures below ~0.80 start to mush.

### Image upload limits

| Limit | Value | Where |
| --- | --- | --- |
| Max file size | **10 MB** | `IMAGE_MAX_MB` in `src/lib/products/media-limits.ts` |
| MIME allowlist | JPEG, PNG, WebP, AVIF (server still accepts WebP for safety; client always produces JPEG) | `EXT_FOR_MIME` in `images-actions.ts` |
| Max dimension | 2400px long edge | `compress-image.ts` → `MAX_DIMENSION_PX` |

The 10 MB server cap is *defense in depth* — compressed JPEGs from
`compressImage()` are typically 300–800 KB. 10 MB is the "something
went very wrong with compression" threshold.

## Videos

### Pipeline

1. **Client-side pre-checks** (in `MediaUploader`):
   - Size > `VIDEO_MAX_BYTES` (100 MB) → toast `m.errors.videoTooLarge`,
     no upload attempt
   - Pass to `extractVideoPoster` to read duration + dimensions
   - Duration > `VIDEO_MAX_DURATION_MS` (30 s) → toast
     `m.errors.videoTooLong`, no upload attempt
2. **Poster extraction** (`extract-video-poster.ts`):
   - Create hidden `<video>` element (`muted`, `playsInline` for iOS)
   - Seek to 1 second (or duration / 2 for very short clips)
   - Paint to a Canvas, export as `image/webp` blob at 0.82 quality
   - Return `{ poster: File | null, durationMs, width, height }`
   - **No transcoding** — the video itself is stored as uploaded
3. **Server upload** via `uploadProductVideo` server action. The
   server re-validates size + duration + MIME + product existence.
   Pushes video AND poster to R2 in sequence, then inserts one row in
   `product_videos`.

### Why no transcoding

Transcoding video in-browser requires FFmpeg.wasm (~25 MB bundle).
Server-side transcoding requires `ffmpeg-static` (a ~50 MB native
binary in the Docker image) plus a transcode step that takes 10–30
seconds per minute of video.

For a 2-user vintage clothing shop where each product has 0–1 short
video and the source is always an iPhone (consistent format), the
complexity isn't worth it. Etsy natively accepts MP4 / MOV / WebM at
≤100 MB, so we're already in their happy path.

### Video upload limits

| Limit | Value | Source / rationale |
| --- | --- | --- |
| Max file size | **100 MB** | `VIDEO_MAX_MB` in `media-limits.ts`. Matches Etsy's hard cap exactly. Covers iPhone HEVC at any resolution up to 4K/30fps for 30s. |
| Max duration | **30 seconds** | `VIDEO_MAX_DURATION_SECONDS` in `media-limits.ts`. Twice the upper end of Etsy's recommended sweet spot (5–15 s); gives more breathing room for showing fabric drape / movement on vintage pieces. |
| MIME allowlist | MP4, MOV, WebM | iPhone shoots MOV (HEVC inside). MP4 from most desktop edits. WebM for completeness. |
| Etsy's hard cap | 100 MB / 60 s | Size matches; we sit under Etsy's 60 s ceiling at 30 s. Publishing to Etsy is a pass-through. |

Both limits live in `src/lib/products/media-limits.ts` — single source
of truth. Changing them auto-updates:

- The dropzone hint text (`m.uploader.media.hintVideos(maxMB, maxSec)`)
- The server validation
- The client pre-check
- The error messages (`videoTooLarge` and `videoTooLong` take the cap
  as a parameter and interpolate it)

The only place that has a duplicate cap value is `next.config.ts`
(framework body-size limits) — see "Body-size caps" below.

### iPhone video size math

For sizing rationale:

| Recording mode | Bitrate (HEVC) | 10s clip | 30s clip |
| --- | --- | --- | --- |
| 1080p / 30fps | ~10 Mbps | ~12 MB | ~37 MB |
| 1080p / 60fps | ~17 Mbps | ~22 MB | ~65 MB |
| 4K / 30fps | ~28 Mbps | ~35 MB | ~105 MB |
| 4K / 60fps | ~50 Mbps | ~62 MB | ~190 MB |

100 MB at 30s covers everything up to 4K/30fps; 4K/30 at 30s lands
right at ~105 MB so it'll occasionally trip the cap if the clip
runs a touch over budget — uploading in 1080p mode is the safe
default. 4K/60fps always rejects, which is fine — that resolution
is overkill for an e-commerce product video.

### HEVC playback compatibility

Modern iPhones default to HEVC in "High Efficiency" mode. **Safari
(macOS + iOS)** plays HEVC natively. **Chrome and Firefox on
Windows / Linux** can play HEVC only via OS codecs — typically
present on Windows 10+ and macOS, often missing on Linux.

For a 2-user admin running on Mac/iPhone, this is a non-issue. If the
public website (separate repo) ever needs broader compatibility,
Phase 4 / Phase 9 can add a server-side transcode step at publish
time (Etsy auto-transcodes anyway).

## R2 key layout

```
retrospectiva (bucket)
└── products/
    └── 2026/                            ← year, from products.createdAt
        └── 05/                          ← month, zero-padded
            └── 15/                      ← day, zero-padded
                └── <product-uuid>/
                    ├── original/        ← uploaded photos
                    │   ├── <uuid>.jpg
                    │   └── …
                    ├── ai_model/        ← Phase 6: AI model placement
                    │   └── <uuid>.jpg
                    ├── video/
                    │   └── <uuid>.mp4
                    └── video_poster/
                        └── <uuid>.webp
```

### Why date-partitioned

- **R2 console browsability.** Drilling into `products/2026/05/` shows
  every product created in May 2026. With UUIDs as the only
  partition, manual browsing would require knowing the UUID upfront.
- **Per-product grouping is preserved.** The date comes from
  `products.createdAt`, formatted in `Europe/Madrid`. Photos added
  three weeks after the product was created still land under that
  product's original date prefix.
- **Deletion semantics stay simple.** Manual hard-delete of a product
  is `deleteR2Prefix(productPrefix(productId, createdAt))` — one
  prefix sweep.

### Why Europe/Madrid (not UTC)

The path date matches what the admin sees in the UI. A product
created at 23:30 Madrid time would land in `2026/05/15/...` in
Madrid time but `2026/05/15` UTC could disagree by a day — confusing
when manually browsing. `formatDatePrefix()` in
`src/lib/integrations/r2/keys.ts` uses `Intl.DateTimeFormat` with
`timeZone: "Europe/Madrid"`.

### Why no migration of historical data

Each `product_images.r2Key` row stores the **full** key. Old paths
(`products/{id}/...`, pre-date-partition) continue to resolve via
`publicUrlFor(row.r2Key, R2_PUBLIC_BASE_URL)` because the URL is
computed from the stored key, not reconstructed. Only **new** uploads
land at the new layout. For our handful of test products, no migration
is worth doing.

## Body-size caps (Next 16 specifics)

Next 16 has **two** request-body size guards, and they're independent:

```
browser → POST /products/[id]
                │
                ▼
        proxy.ts ─── proxyClientMaxBodySize (default 10 MB)
                │   ← we set 110 MB; without this, a 100 MB video gets
                │     clipped to 10 MB and the action sees a torn
                │     multipart body
                ▼
        server action ─── serverActions.bodySizeLimit (default 1 MB)
                │   ← we set 110 MB; without this, the framework returns
                │     a 413 before the action's own size check fires
                ▼
        upload to R2
```

Both are configured in `next.config.ts`. They must be ≥ the
user-facing `VIDEO_MAX_BYTES` (100 MB), with a small cushion for
multipart-form overhead. We use **110 MB** on both, giving 10 MB of
headroom.

If you raise the user-facing video cap, bump these too — otherwise
the framework cap wins silently and you'll see the cryptic
"Unexpected end of form" error (the multipart parser failing on a
truncated body) instead of the friendly "vídeo demasiado grande"
toast.

## The MediaUploader component

`src/components/forms/media-uploader.tsx` is a single drop target that
handles both pipelines. The user sees:

```
┌──────────────────────────────────────────────┐
│           [upload icon]                      │
│       Suelta fotos o vídeos aquí             │
│  Fotos · JPEG/PNG/WebP/AVIF/HEIC · …         │
│  Vídeos · MP4/MOV/WebM · máx. 100 MB y 30 s  │
│           [ Elegir archivos ]                │
└──────────────────────────────────────────────┘
```

Files are processed **sequentially** (one at a time), with a single
"Subiendo…" state for the whole batch. End-of-batch toast summarizes
both counts in one Spanish-correct message:

- 1 photo → `"Foto subida"`
- N photos → `"${N} fotos subidas"`
- 1 video → `"Vídeo subido"`
- mixed → `"Subido: ${imagesPart} y ${videosPart}"`

See `m.toasts.mediaUploaded` in `src/lib/i18n/messages.es.ts`.

## Galleries (display)

The galleries stay separate because their layouts diverge:

- `ImageList` — responsive grid (`grid-cols-2 sm:grid-cols-3
  md:grid-cols-4`), each tile is the photo with a "Primary" badge on
  the first one. Controls: ↑ / ↓ / ★ / 🗑.
- `VideoList` — vertical list, each row has a `<video controls
  preload="metadata" poster={posterUrl}>` plus mimeType / dimensions
  / duration as caption. Controls: ↑ / ↓ / 🗑 (no "set primary" —
  videos don't have a "cover" concept, the first one is the only one
  for Etsy publish).

Both subsections live inside the single "Contenido multimedia" card
on the product detail page, with the dropzone above and the two
subsections below.

## Things to know before changing anything

- **Don't add server-side WebP encoding.** Etsy doesn't accept WebP;
  JPEG is the correct output format for Phase 4 publish.
- **Don't merge the gallery components.** Two separate layouts are
  the right answer; the merged uploader already gives the UX win.
- **`media-limits.ts` is the only place to change caps.** Touch one
  constant; everything downstream (action validation, client check,
  hint text, error messages) updates automatically. Only
  `next.config.ts`'s framework caps need a manual bump if you cross
  the 60 MB threshold.
- **Date-partitioned keys need `createdAt`.** The image and video
  upload actions both pull `createdAt` from the products table when
  verifying the product exists. New roles / endpoints adding to R2
  should do the same.
- **R2 keys are stored in full.** If you change the layout, OLD keys
  keep working because `r2Key` in the DB carries the full path. New
  uploads use the new shape. No migration is normally needed.
