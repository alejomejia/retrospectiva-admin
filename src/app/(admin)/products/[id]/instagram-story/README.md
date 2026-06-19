# Instagram-story templates

`GET /products/[id]/instagram-story?variant=<key>&imageId=<id>` renders a
1080×1920 PNG with `next/og` (satori). The template is chosen by `variant`
(default `new`); the background photo by `imageId` (default = featured).

## Layout

```
route.tsx              auth → gate by variant/status → resolve photo + assets → render
story.const.ts         shared tokens (palette, fonts, gradients, canvas)
story-frame.tsx        <StoryFrame> chrome (photo + dim + logo + content column;
                         `dim="split"|"flat"`, optional `overlay`)
                       + primitives: StoryPill, StoryEyebrow, StoryTitlePrice,
                         StoryTitleAccent, StoryCta, StoryFooter, StorySeal
load-fonts.ts          vendored fonts + logo + seal (data URIs), module-cached
fonts/ assets/         Playfair (upright+italic)/DM Sans/DM Mono TTFs,
                         transparent logo.svg + sold-seal.png
templates/
  types.ts             StoryRenderContext, StoryRenderer
  index.ts             STORY_RENDERERS: variant key → renderer
  new-story.tsx        the "New today" template
  sold-story.tsx       the "Sold" template (flat dim + centred SOLD seal)

src/lib/products/instagram-story-variants.ts   client-safe descriptor
                       (StoryVariantKey, which statuses each variant applies to)
src/lib/products/instagram-story.ts            pure copy helpers (eyebrow, price)
src/components/products/instagram-story-dialog/ the picker/preview/download UI
```

Why the descriptor lives in `lib`: both the server route and the client
dialog import it, so it must stay free of React/satori/server code.

Two templates ship today — `new` (`instagram-post-new`) and `sold`
(`instagram-post-sold`). `sold` is the reference for a template that diverges
from the default chrome: it passes `dim="flat"` (uniform ink veil instead of
the split gradients) and an `overlay={<StorySeal …>}` (the centred SOLD
stamp), and uses `StoryTitleAccent` (italic Playfair word, e.g. "Gone") in
place of `StoryTitlePrice`.

## Add a template

1. **Design** the frame in Figma (`socials` page). Pull values into
   `story.const.ts` if any new shared token is needed; otherwise reuse. If the
   chrome differs (dim, a centred overlay), extend `StoryFrame`'s props rather
   than forking it.
2. **Descriptor** — in `src/lib/products/instagram-story-variants.ts` add the
   key to `StoryVariantKey` and an entry to `STORY_VARIANTS` with the product
   statuses it applies to, e.g. `{ key: "sold", statuses: ["sold"] }`.
3. **Label** — add `products.instagramStory.variants.<key>` in
   `messages.es.ts` (and any baked-in English copy, e.g. a CTA).
4. **Assets** — vendor any new font weight/style under `fonts/` and image
   under `assets/`, and load it (module-cached) in `load-fonts.ts`. Add new
   per-render assets to `StoryRenderContext` and load them in `route.tsx`.
5. **Template** — create `templates/<key>-story.tsx` exporting a
   `StoryRenderer`. Compose `<StoryFrame>` + the primitives (or custom JSX).
   Derive copy from `ctx.product` (reuse helpers in
   `lib/products/instagram-story.ts`).
6. **Register** — add it to `STORY_RENDERERS` in `templates/index.ts`. The
   `Record<StoryVariantKey, …>` makes a missing renderer a type error.

### Blurred photo (the SOLD frame's `flat` dim)

The Figma `instagram-post-sold` overlay layer uses a 50px **background blur**
(backdrop-filter) under an 80% ink fill. satori supports neither
`backdrop-filter` nor `filter` on an `<img>`, but it _does_ apply `filter` to
a parent element's whole subtree — so `StoryFrame`'s `flat` branch wraps the
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

The route gates on `variantsForStatus(product.status)`; the dialog shows a
variant picker automatically when more than one applies. No route/UI edits
needed to add a template.

## Notes

- satori reads inline styles only — no Tailwind / CSS vars. Every multi-child
  box needs `display: flex`. Glyphs missing from the font fall back to colour
  emoji (see the inline SVG arrow in `StoryCta`).
- Fonts must match the design weights: Playfair Display **500** (upright +
  italic — the italic static instance is pinned from the variable italic at
  `wght 500`), DM Sans **500**, DM Mono **400**.
