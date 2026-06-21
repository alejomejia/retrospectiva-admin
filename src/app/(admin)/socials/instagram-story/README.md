# Instagram-story templates

`GET /socials/instagram-story?productId=<id>&variant=<key>&imageId=<id>&<field>=<text>…`
renders a 1080×1920 PNG with `next/og` (satori). The product is identified by
`productId`; the template chosen by `variant` (default `new`); the background
photo by `imageId` (default = featured); each text slot by a per-field override
param (default = computed from the product — see the fields lib below).

The user-facing flow lives one level up: `/socials` lists the post types, each
opening `/socials/[variant]` where a product is searched/picked (`?productId=`)
before the studio renders. This endpoint is the render backend they hit.

## Layout

```
route.tsx              auth → gate by variant/status → resolve photo + assets
                         + fields → render
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
src/components/socials/instagram-studio/        the picker/preview/edit/download UI
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
   in `messages.es.ts`, and the variant's name under
   `products.instagramStory.variants.<key>`.
4. **Assets** — vendor any new font weight/style under `fonts/` and image under
   `assets/`, and load it (module-cached) in `load-fonts.ts`. Add new per-render
   assets to `StoryRenderContext` and load them in `route.tsx`.
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
