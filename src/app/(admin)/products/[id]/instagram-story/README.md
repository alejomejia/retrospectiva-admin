# Instagram-story templates

`GET /products/[id]/instagram-story?variant=<key>&imageId=<id>` renders a
1080×1920 PNG with `next/og` (satori). The template is chosen by `variant`
(default `new`); the background photo by `imageId` (default = featured).

## Layout

```
route.tsx              auth → gate by variant/status → resolve photo + assets → render
story.const.ts         shared tokens (palette, fonts, gradients, canvas)
story-frame.tsx        <StoryFrame> chrome (photo + gradients + logo + content column)
                       + primitives: StoryPill, StoryEyebrow, StoryTitlePrice,
                         StoryCta, StoryFooter
load-fonts.ts          vendored fonts + logo (data URI), module-cached
fonts/ assets/         Playfair/DM Sans/DM Mono TTFs + transparent logo.svg
templates/
  types.ts             StoryRenderContext, StoryRenderer
  index.ts             STORY_RENDERERS: variant key → renderer
  new-story.tsx        the "New today" template

src/lib/products/instagram-story-variants.ts   client-safe descriptor
                       (StoryVariantKey, which statuses each variant applies to)
src/lib/products/instagram-story.ts            pure copy helpers (eyebrow, price)
src/components/products/instagram-story-dialog/ the picker/preview/download UI
```

Why the descriptor lives in `lib`: both the server route and the client
dialog import it, so it must stay free of React/satori/server code.

## Add a template (e.g. `sold`)

1. **Design** the frame in Figma (`socials` page). Pull values into
   `story.const.ts` if any new shared token is needed; otherwise reuse.
2. **Descriptor** — in `src/lib/products/instagram-story-variants.ts` add the
   key to `StoryVariantKey` and an entry to `STORY_VARIANTS` with the product
   statuses it applies to, e.g. `{ key: "sold", statuses: ["sold"] }`.
3. **Label** — add `products.instagramStory.variants.sold` in
   `messages.es.ts`.
4. **Template** — create `templates/sold-story.tsx` exporting a
   `StoryRenderer`. Compose `<StoryFrame>` + the primitives (or custom JSX).
   Derive copy from `ctx.product` (reuse helpers in
   `lib/products/instagram-story.ts`).
5. **Register** — add it to `STORY_RENDERERS` in `templates/index.ts`. The
   `Record<StoryVariantKey, …>` makes a missing renderer a type error.

The route gates on `variantsForStatus(product.status)`; the dialog shows a
variant picker automatically when more than one applies. No route/UI edits
needed to add a template.

## Notes

- satori reads inline styles only — no Tailwind / CSS vars. Every multi-child
  box needs `display: flex`. Glyphs missing from the font fall back to colour
  emoji (see the inline SVG arrow in `StoryCta`).
- Fonts must match the design weights: Playfair Display **500**, DM Sans
  **500**, DM Mono **400**.
