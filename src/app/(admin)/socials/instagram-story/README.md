# Instagram-story generation

Two render backends, one shared resolution path:

- **Still (PNG)** —
  `GET /socials/instagram-story?productId=<id>&variant=<key>&imageId=<id>&transparent=<0|1>&<field>=<text>…`
  renders a 1080×1920 PNG with `next/og` (satori).
- **Video (MP4)** —
  `GET /socials/instagram-story/video?productId=<id>&variant=<key>&videoId=<id>&<field>=<text>…`
  composites the (transparent) chrome over a product video with **ffmpeg**.

The product is identified by `productId`; the template chosen by `variant`
(default `new`); the background photo by `imageId` (default = featured); the
background video by `videoId` (default = first); each text slot by a per-field
override param (default = computed from the product — see the fields lib below).

`transparent=1` (still only) drops the product photo **and** the opaque frame
background, emitting a PNG with a transparent canvas (gradients, copy, logo,
seal only) — for overlaying the chrome on a video by hand. The video endpoint
forces this internally (the video is the background); see "Video export" below.

The user-facing flow lives one level up: `/socials` lists the post types, each
opening `/socials/[variant]` where a product is searched/picked (`?productId=`)
before the studio renders. These endpoints are the render backend they hit.

## Layout

```
route.tsx              still PNG: auth → prepareStoryRender → ImageResponse
story-render.ts        prepareStoryRender — the SHARED resolution path (gate by
                         variant/status, pick photo, load assets, resolve
                         fields, build the satori element). Both routes call it;
                         `forceTransparent` for the video overlay.
video/
  route.tsx            MP4: auth → prepareStoryRender(forceTransparent) →
                         raster overlay + fetch video → composeStoryVideo
  compose-story-video.ts  shells out to ffmpeg (cover-crop + overlay + encode)
story.const.ts         shared tokens (palette, fonts, gradients, canvas)
story/                 compound satori primitives — Story = Object.assign(Frame, {…})
  index.tsx              Story.Frame / .Pill / .Eyebrow / .TitlePrice /
                         .TitleAccent / .Cta / .Footer / .Seal
  story-frame.tsx        chrome (photo + dim + logo + content column;
                         `dim="split"|"flat"`, optional `overlay`)
  story-<slot>.tsx       one file per slot primitive
load-fonts.ts          vendored fonts + logo + seal (data URIs), module-cached
fonts/ assets/         Playfair (upright+italic)/DM Sans/DM Mono TTFs,
                         transparent logo.svg + sold-seal.png
templates/
  types.ts             StoryRenderContext (fields + assets), StoryRenderer
  index.ts             STORY_RENDERERS: variant key → renderer
  new-story.tsx        the "New today" template
  sold-story.tsx       the "Sold" template (flat dim + centred SOLD seal)

src/lib/products/instagram-story-variants.ts   client-safe descriptor
                       (StoryVariantKey, which statuses each variant applies to)
src/lib/products/instagram-story-fields.ts     client-safe field model
                       (STORY_FIELDS, defaults, parse/resolve overrides)
src/lib/products/instagram-story.ts            pure copy helpers (eyebrow, price)
src/components/socials/instagram-studio/        the picker/preview/edit UI:
                       photo + video pickers, copy form, transparent-background
                       toggle, PNG + MP4 downloads (use-instagram-studio.ts)
```

Why the descriptor + fields live in `lib`: both the server route and the
client studio import them, so they must stay free of React/satori/server code.

Templates read their copy from `ctx.fields` — they no longer derive it from the
product. The route resolves `fields` once via `resolveStoryFields` (defaults
from `defaultStoryFields`, overlaid with the request's override params), so the
studio form can edit any slot before download.

Two templates ship today — `new` (`instagram-post-new`) and `sold`
(`instagram-post-sold`). `sold` is the reference for a template that diverges
from the default chrome: it passes `dim="flat"` (uniform ink veil instead of
the split gradients) and an `overlay={<Story.Seal …>}` (the centred SOLD
stamp), and uses `Story.TitleAccent` (italic Playfair word, e.g. "Gone") in
place of `Story.TitlePrice`.

## Add a template

1. **Design** the frame in Figma (`socials` page). Pull values into
   `story.const.ts` if a new shared token is needed; otherwise reuse. If the
   chrome differs (dim, a centred overlay), extend `Story.Frame`'s props rather
   than forking it; add a new slot as `story/story-<slot>.tsx` and register it
   on the compound `Story` in `story/index.tsx`.
2. **Descriptor** — in `instagram-story-variants.ts` add the key to
   `StoryVariantKey` and an entry to `STORY_VARIANTS` with the statuses it
   applies to, e.g. `{ key: "sold", statuses: ["sold"] }`.
3. **Fields** — in `instagram-story-fields.ts` add the variant's editable slots
   to `STORY_FIELDS` and its defaults to `defaultStoryFields` (any new field
   key goes on `StoryFieldKey`). Add a Spanish label under `socials.fields.<key>`
   in `messages.en.ts`, and the variant's name under
   `products.instagramStory.variants.<key>`.
4. **Assets** — vendor any new font weight/style under `fonts/` and image under
   `assets/`, and load it (module-cached) in `load-fonts.ts`. Add new per-render
   assets to `StoryRenderContext` and load them in `story-render.ts`
   (`prepareStoryRender`), which both the still and video routes share.
5. **Template** — create `templates/<key>-story.tsx` exporting a
   `StoryRenderer`. Compose `<Story.Frame>` + the slot primitives, reading copy
   from `ctx.fields.*`.
6. **Register** — add it to `STORY_RENDERERS` in `templates/index.ts`. The
   `Record<StoryVariantKey, …>` makes a missing renderer a type error.

### Blurred photo (the SOLD frame's `flat` dim)

The Figma `instagram-post-sold` overlay layer uses a 50px **background blur**
(backdrop-filter) under an 80% ink fill. satori supports neither
`backdrop-filter` nor `filter` on an `<img>`, but it _does_ apply `filter` to
a parent element's whole subtree — so `Story.Frame`'s `flat` branch wraps the
photo in a clipping `<div>` carrying `filter: blur(STORY_DIM_BLUR)`, with the
photo oversized by `STORY_DIM_BLUR_OVERSCAN` per edge so the blur samples real
pixels instead of feathering to transparent. The sharp 0.8 ink veil sits on
top. Re-tune both constants in `story.const.ts`, not the JSX.

### Transparent stamp assets (the SOLD seal)

The Figma seal is an opaque ink box composited with a blend mode, so an
isolated export carries that box. It was keyed to transparency offline
(alpha = brightness above the ink baseline, linework recoloured to cream) so
satori — which has no blend-mode support — can lay it over the photo. Re-key,
don't drop the raw export in.

The route gates on `variantsForStatus(product.status)` (never trust the client).
The variant is fixed by the page route (`/socials/[variant]`), so the studio
renders exactly one template — no in-studio variant picker. Adding a template
needs no route edits; it surfaces as a new landing card via `STORY_VARIANTS`.

## Transparent overlay (PNG)

`?transparent=1` makes `Story.Frame` skip the product photo and set the root
background to `transparent` instead of `STORY_COLORS.ink`. Everything else is
kept — `next/og`/resvg emits a PNG with alpha wherever the canvas is uncovered,
and the gradients already fade to `rgba(...,0)`, so they composite correctly
over whatever sits behind. The studio exposes this as a "Fondo transparente"
switch (default **off** — the background photo is included).

Caveats baked into the design, not bugs:

- `new`: the bottom gradient is near-opaque (`0.94`) behind the copy — that is
  the legibility scrim, so the lower third stays dark over a video.
- `sold`: `dim="flat"` is a full-frame 80% ink veil, so the whole overlay is a
  translucent ink panel (not just behind the seal).

## Video export

Composites the **transparent** chrome over a product video → MP4. Same copy /
variant params as the still; the difference is the background is a moving video
instead of a photo.

Pipeline (`video/route.tsx` → `compose-story-video.ts`):

1. `prepareStoryRender(req, { forceTransparent: true })` — the shared path,
   forced transparent (the video is the background, so the photo is never drawn).
2. Rasterize the chrome to a transparent PNG via `ImageResponse(...).arrayBuffer()`.
3. Fetch the chosen product video from R2 into memory.
4. `ffmpeg`: cover-crop the video to 1080×1920 and overlay the PNG, encode H.264.

### Decisions (and why)

- **Synchronous, in-request** (no BullMQ job). Product videos are capped at
  30 s / 100 MB (`media-limits.ts`); a `-preset veryfast` libx264 pass finishes
  in a few seconds, and this is a 2-user admin. If it ever needs to scale, move
  `composeStoryVideo` into the worker and switch the route to enqueue + poll.
- **Cover-crop** (`scale=…:force_original_aspect_ratio=increase,crop=…`) — fill
  the 9:16 canvas and crop overflow, matching the photo's `objectFit: cover`.
  Horizontal videos lose their sides; that was the chosen trade-off over
  letterboxing.
- **Audio stripped** (`-an`) — IG stories autoplay muted; smaller files.
- **`overlay=…:eof_action=repeat`, no `-loop`/`-shortest`** — the single PNG
  frame is held for the whole clip and the output length tracks the (finite)
  video. Looping the image input instead made `-shortest` unreliable and let
  the encode run away.
- **ffmpeg is a hard dependency** — satori can't touch video. Installed in the
  Dockerfile runner stage (`apk add ffmpeg`); locally it's whatever `ffmpeg` is
  on `PATH`. Missing binary surfaces as a logged `ENOENT`.
- **Forced `runtime = "nodejs"` + `maxDuration = 120`** — needs child_process,
  temp files, and on-disk fonts; the cap gives the encode headroom.

### Debugging a failed render

Failures are intentionally loud (it's an internal tool):

- **Server** logs every stage to container stdout under `[dev:socials-video]`
  (`devGroup`): the request (product/variant/video id, mime, size, source dims,
  duration), the **full ffmpeg command** (copy-paste to reproduce on the box),
  and on failure the **tail of ffmpeg stderr**.
- **Client** reads the error text the route returns in the response body and
  logs it to the browser console (`[dev] video generation failed …`) plus a
  trimmed `description` in the error toast.
- **The 500/502 body carries the real message** (e.g. `Video render failed:
  ffmpeg exited 1: …`, or `Failed to prepare inputs: video fetch 404 …`) — safe
  here because it's a 2-user admin. Grab it from the toast, the browser console,
  or `docker compose logs app`, and share it verbatim.

Quick triage by message: `ffmpeg exited …` → encoder/filter problem (read the
stderr tail); `video fetch <status>` → the R2 object/URL; `ENOENT`/spawn → ffmpeg
not installed in the image.

## Notes

- satori reads inline styles only — no Tailwind / CSS vars. Every multi-child
  box needs `display: flex`. Glyphs missing from the font fall back to colour
  emoji, so draw such marks as inline SVG (vs. relying on a font glyph).
- `Story.Cta` renders nothing — it's a fixed 133px transparent spacer holding
  the spot where an Instagram CTA *sticker* is dropped by hand after export.
  `Story.Footer` is the tagline only (the handle was removed); both frames
  anchor the content column 150px from the bottom.
- Slot primitives return `null` for empty copy, so a cleared nullable field
  (eyebrow, price) drops its element cleanly.
- Fonts must match the design weights: Playfair Display **500** (upright +
  italic — the italic static instance is pinned from the variable italic at
  `wght 500`), DM Sans **500**, DM Mono **400**.
- Override params are untrusted: `parseFieldOverrides` clamps each to a max
  length before it reaches satori.
