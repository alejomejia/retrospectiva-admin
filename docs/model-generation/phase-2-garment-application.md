# Phase 2 · Garment application

The second stage of the
[model-generation pipeline](./README.md). Takes a saved Phase 1
model (a face/identity already locked into R2) plus a reference
photo of a real second-hand garment, and produces an on-model
fitting image where the garment is applied to the model with
authentic vintage fabric behavior.

> Status: prompt drafted, not yet wired into code. Iterate against
> the live `gpt-image-2` model before integrating. The next
> implementation step is per-product image generation surfaced
> from the product form — that ticket consumes this prompt; this
> doc only specifies the prompt contract.

> The Phase 1 doc keeps identity as a single monolithic string.
> Phase 2 is **modular** by design — it composes 8 discrete blocks
> (identity lock, garment transfer, garment-behavior module, styling,
> pose preset, framing preset, environment preset, realism block) at
> call time. Several blocks have multiple variants chosen per input;
> the runtime concatenates them in a fixed order.

---

## 1 · Goal

Given:

- a saved Phase 1 model (specifically one of its cropped panels),
- a reference photo of a real garment from the shop's inventory,
- a small set of categorical inputs (garment category, environment,
  pose, framing),

produce a single on-model image where:

- the model's identity (face, body, hair, skin) is preserved
  unchanged from the Phase 1 reference,
- the garment is transferred onto the model with its original
  stitching, color, fading, wrinkles, prints, and second-hand
  characteristics intact (no AI "cleanup" or restyling),
- the rest of the composition (pose, framing, environment, light,
  styling accessories) reads as a real ecommerce / lifestyle
  listing rather than an editorial fashion shoot.

Run frequency: **per product** (one or more calls per listing).
This is the high-volume stage of the pipeline; Phase 1 is the
low-frequency setup.

---

## 2 · Output shape

A single on-model image (not a grid). Dimensions follow the
Etsy + social aspect ratios that Phase 3 product media already
uses; the prompt itself is dimension-agnostic.

Unlike Phase 1, Phase 2 is **not** a contact sheet. Each call
produces one composition — repeated calls with different framing
or environment presets are how variants are generated.

---

## 3 · Modular prompt architecture

The full prompt is assembled by concatenating 8 blocks in a fixed
order. Each block is independent; some are always active, others
are selected dynamically from a small set of presets based on the
app inputs.

```
[IDENTITY_LOCK]              ← always

[GARMENT_TRANSFER]           ← always (interpolates {GARMENT_TYPE},
                                {FIT_OVERRIDE})

[GARMENT_BEHAVIOR_MODULE]    ← 1 of 5, chosen by garment category

[STYLING_ACCESSORIES_MODULE] ← optional, recommended on by default

[POSE_PRESET]                ← 1 of 3

[FRAMING_PRESET]             ← 1 of 4

[ENVIRONMENT_PRESET]         ← 1 of 5

[REALISM_BLOCK]              ← always
```

Blocks are joined with a blank line between them. The runtime
should not reorder them — the order matters for how the model
weights the constraints (identity first, garment second, behavior
+ styling third, composition fourth, realism as the final
override).

---

## 4 · Identity lock (always active)

```
Preserve the exact same woman from the base reference image with identical facial structure, body proportions, skin tone, hairstyle, anatomy, and identity. Do not alter the model's face, body shape, height proportions, hands, shoulders, or overall appearance.

The existing base image must remain the foundation of the composition. Only apply the garment naturally onto the existing model while preserving realistic anatomy, natural posture, and original photographic realism.
```

The "base reference image" referred to is the model panel attached
to the call as image input (see §11). The text block does the work
of pinning identity; the image input does the work of providing it.

---

## 5 · Garment transfer (always active)

### Variables

| Name | Required | Notes |
| --- | --- | --- |
| `{GARMENT_TYPE}` | yes | Short noun phrase resolved at call time from the product's `clothingType` via the canonical clothing-types registry's English label (`src/lib/products/clothing-types.ts`). Examples: `shirt`, `vest`, `trench coat`, `corset`, `jean`, `skirt`, `dress`, `overall`, `two-piece set`. |
| `{FIT_OVERRIDE}` | no | Enum: `null \| 'tight' \| 'loose' \| 'oversized'`. When non-null, the runtime appends one of three pre-baked sentences (see below) to the Garment Transfer block. When `null` the line is omitted entirely. |

#### Pre-baked fit-override sentences

```
tight:     Apply a tight body-hugging fit with realistic fabric tension and natural compression points.
loose:     Apply a loose relaxed fit with generous fabric volume and natural draping.
oversized: Apply an oversized fit with intentional excess fabric, relaxed proportions, and authentic vintage layering.
```

### Module

```
Apply the provided {GARMENT_TYPE} from the reference garment image onto the existing model while preserving the exact original garment structure, stitching, proportions, folds, wrinkles, fabric texture, buttons, seams, patterns, graphics, fading, wear, and authentic vintage details.

Preserve the exact garment colors and textile behavior from the original garment image. Maintain realistic fabric physics, natural gravity-based draping, believable sleeve tension, realistic fabric bunching, and authentic second-hand garment characteristics.

Do not redesign, reinterpret, modernize, clean up, or stylize the garment.

{FIT_OVERRIDE}
```

### Detail extension (always appended)

This paragraph is appended to the Garment Transfer block on every
call (no flag). Cheap insurance against the model flattening
prints, fading, or weave texture even on plain garments.

```
Preserve the authentic vintage print scale, original textile color fading, realistic woven fabric texture, and natural aged fabric characteristics from the original garment image.
```

---

## 6 · Garment behavior module (1 of 5)

Selected by the garment category. Each category maps to one of
five behavior blocks — pick exactly one per call.

### Category: `UPPER_BODY`

Garments: `shirt`, `vest`, `top`, `sweater`, `jacket`.

```
Maintain realistic upper-body garment behavior with natural fabric draping around the shoulders, chest, waist, sleeves, and torso. Preserve authentic fabric tension, realistic folds, soft bunching, sleeve compression, and believable textile weight.

The garment should interact naturally with the model's posture and anatomy while maintaining realistic relaxed vintage clothing behavior, authentic second-hand texture characteristics, and believable casual wear imperfections.
```

### Category: `TRENCH_COAT`

Garments: `trench_coat`.

```
Maintain realistic trench coat weight, vertical draping, layered outerwear structure, natural sleeve volume, and believable long-garment fabric gravity. Preserve authentic oversized silhouette behavior, realistic coat movement, natural open-front layering behavior, and subtle heavy-fabric tension.

The trench coat should feel naturally worn with realistic lower-body draping, soft movement, and believable vintage outerwear structure without exaggerated fashion-editorial posing.
```

### Category: `SPECIAL_STRUCTURE`

Garments: `corset`.

```
Maintain realistic corset structure, authentic fabric tension, natural compression behavior, and believable body contour interaction. Preserve the exact corset shape, boning structure, stitching, tightening behavior, and realistic textile rigidity without distorting anatomy.

The corset should feel naturally worn with subtle realistic fabric tension around the torso, believable shaping behavior, and authentic vintage garment structure while maintaining realistic human proportions and soft natural posture.
```

### Category: `LOWER_BODY`

Garments: `jean`, `pant`, `skirt`, `short`.

```
Maintain realistic lower-body garment behavior with authentic fabric interaction around the waist, hips, thighs, knees, and legs. Preserve natural folds, believable compression points, realistic draping, subtle bunching, and authentic second-hand textile behavior.

The garment should respond naturally to posture, gravity, and body positioning while maintaining believable vintage wear patterns, realistic silhouette flow, and authentic fabric tension.
```

### Category: `COMPLETE_GARMENTS`

Garments: `set`, `overall`, `dress`, `bodysuit`.

```
Maintain realistic full-body garment behavior with natural fabric flow across the upper and lower body, believable silhouette transitions, authentic textile draping, and realistic body movement interaction.

Preserve natural garment continuity, realistic folds, subtle fabric tension, believable gravity behavior, and authentic vintage texture characteristics throughout the entire outfit.

The garment should feel naturally worn and realistically fitted without exaggerated perfection or artificial fashion-editorial styling.
```

### Set extension (auto-appended for `set`)

Appended automatically when `clothingType === 'set'` (no flag).
The other COMPLETE_GARMENTS members — `overall`, `dress`,
`bodysuit` — do not get this paragraph.

```
Preserve the coordinated relationship between all garment pieces, including matching fabric behavior, proportional consistency, textile continuity, and authentic outfit balance.
```

---

## 7 · Styling / accessories module (optional)

Default: **on**. Disable per call when the user wants the garment
photographed bare (no jewelry, no layering basics).

```
Style the model with subtle vintage-inspired complementary clothing layers and minimal accessories that naturally match the garment's aesthetic, era, color palette, silhouette, and overall mood.

The styling should feel authentic, understated, and naturally assembled by a real person rather than professionally fashion-styled.

Accessories may include subtle vintage jewelry, small earrings, delicate necklaces, simple rings, thin belts, neutral layering basics, or soft lifestyle elements that complement the garment without competing with it.

All additional styling elements must remain visually secondary to the main garment being sold.

Avoid statement accessories, luxury fashion styling, excessive layering, loud colors, oversized jewelry, trend-heavy aesthetics, editorial fashion compositions, or distracting secondary garments.

The primary garment must remain the clear visual focus of the entire image.
```

---

## 8 · Pose presets (1 of 3)

### Preset: `SOFT_RELAXED` (default)

```
Natural relaxed standing posture with subtle human asymmetry, soft shoulder positioning, relaxed arms, natural hand placement, slight weight shift, and believable casual body posture. The pose should feel natural and unintentionally stylish, like a real person casually modeling clothing for a vintage marketplace listing.
```

### Preset: `SOFT_MOVEMENT`

```
Subtle natural body movement with relaxed posture, gentle motion in the arms and torso, and believable casual lifestyle energy. Maintain realistic fabric movement without exaggerated fashion posing.
```

### Preset: `STRUCTURED_POSTURE`

```
Confident upright posture with subtle relaxed elegance, minimal movement, natural arm positioning, and clear garment visibility while maintaining a believable human stance.
```

---

## 9 · Framing presets (1 of 4)

### Preset: `WAIST_UP`

```
Medium lifestyle crop framed from approximately waist level upward, maintaining strong garment visibility, natural composition, and authentic vintage ecommerce photography aesthetics.
```

### Preset: `THIGHS_UP`

```
Lifestyle fashion crop framed from mid-thigh upward with balanced visibility of the garment silhouette, natural body proportions, and casual ecommerce photography composition.
```

### Preset: `FULL_BODY`

```
Full body vertical composition with realistic proportions, natural stance, and clean visibility of the entire garment while maintaining relaxed lifestyle realism.
```

### Preset: `CLOSE_DETAIL`

```
Closer editorial-style garment framing focused on textile detail, upper body styling, and realistic fabric texture while preserving believable lifestyle photography realism.
```

---

## 10 · Environment presets (1 of 5)

### Preset: `TEXTURED_WALL` (default)

```
Soft natural lifestyle photography near a lightly textured neutral wall with subtle daylight illumination, minimal distractions, soft natural shadows, and clean vintage ecommerce aesthetics.
```

### Preset: `MINIMAL_APARTMENT`

```
Minimal warm apartment interior with soft natural daylight, subtle furniture presence, neutral tones, and believable lived-in atmosphere without distracting from the garment.
```

### Preset: `SOFT_STUDIO`

```
Clean soft studio environment with subtle natural shadows, neutral tones, diffused daylight-style illumination, and realistic professional ecommerce photography atmosphere.
```

### Preset: `VINTAGE_HOME`

```
Subtle vintage-inspired home environment with soft natural lighting, warm neutral textures, minimal visual distractions, and authentic cozy lifestyle realism.
```

### Preset: `WINDOW_LIGHT`

```
Soft window-side natural lighting with realistic daylight falloff, gentle shadows, warm natural atmosphere, and believable candid lifestyle photography aesthetics.
```

---

## 11 · Realism block (always active)

```
Ultra realistic humanized ecommerce photography with authentic natural imperfections, realistic textile behavior, subtle asymmetry, believable posture, realistic skin texture, soft natural lighting, and genuine human presence.

The final image should feel like a real vintage clothing listing photographed by a real person for a real marketplace, not like an AI-generated luxury fashion campaign.

Avoid overprocessed skin, artificial perfection, exaggerated posing, editorial fashion aesthetics, cinematic lighting, unrealistic anatomy, distorted hands, distorted garments, excessive beauty retouching, or overly stylized AI aesthetics.
```

---

## 12 · Category → default mapping

The defaults the runtime applies when the user hasn't explicitly
picked a value on the product form. Behavior is hard-routed from
`clothingType`; pose / framing / environment are global defaults;
source panel defaults per category but is a select the user can
override.

```json
{
  "UPPER_BODY":         { "behavior": "UPPER_BODY",         "sourcePanel": "front_full"         },
  "TRENCH_COAT":        { "behavior": "TRENCH_COAT",        "sourcePanel": "threequarter_full"  },
  "SPECIAL_STRUCTURE":  { "behavior": "SPECIAL_STRUCTURE",  "sourcePanel": "front_full"         },
  "LOWER_BODY":         { "behavior": "LOWER_BODY",         "sourcePanel": "threequarter_full"  },
  "COMPLETE_GARMENTS":  { "behavior": "COMPLETE_GARMENTS",  "sourcePanel": "threequarter_full"  }
}
```

Global defaults (apply to every category unless overridden on the
product form):

| Field | Default |
| --- | --- |
| `aiPosePreset` | `soft_relaxed` |
| `aiFramingPreset` | `waist_up` |
| `aiEnvironmentPreset` | `textured_wall` |
| `aiFitOverride` | `null` |

> The original recommendation listed `side_full` as a candidate
> source panel for trench coats. The Phase 1 contact sheet does
> not produce a full-body side panel — it produces `side_portrait`
> (head/shoulders only). `threequarter_full` substitutes; revisit
> only if iteration shows the angle isn't enough.

---

## 13 · App input contract

Field names match what gets persisted as `products.ai*` columns
(see [../per-product-image-gen.md](../per-product-image-gen.md)
"Schema"). The runtime is the worker — `assembleImagePlacementPrompt`
takes these inputs and produces the 8-block string.

### Required

```ts
type ImagePlacementInput = {
  aiModelId: string;          // FK → ai_models.id; must be status='active'
  clothingType: string;       // canonical key from clothing-types registry; drives behavior + GARMENT_TYPE
  aiPosePreset: PosePreset;
  aiFramingPreset: FramingPreset;
  aiEnvironmentPreset: EnvironmentPreset;
};
```

| Field | Type | Notes |
| --- | --- | --- |
| `aiModelId` | uuid | Picks the Phase 1 model. Worker resolves the panel image via `aiSourcePanel` (or category default) and loads it from R2. |
| `clothingType` | enum | One of the registry keys in `src/lib/products/clothing-types.ts`. Drives both `{GARMENT_TYPE}` (via registry English label) and the behavior block (§6 mapping). |
| `aiPosePreset` | enum | Lowercase snake_case values: `soft_relaxed` \| `soft_movement` \| `structured_posture`. |
| `aiFramingPreset` | enum | `waist_up` \| `thighs_up` \| `full_body` \| `close_detail`. |
| `aiEnvironmentPreset` | enum | `textured_wall` \| `minimal_apartment` \| `soft_studio` \| `vintage_home` \| `window_light`. |

### Optional

```ts
type ImagePlacementOptional = {
  aiSourcePanel?: PanelKey | null;          // null ⇒ use category default per §12
  aiFitOverride?: 'tight' | 'loose' | 'oversized' | null;
};
```

| Field | Type | Notes |
| --- | --- | --- |
| `aiSourcePanel` | enum or null | One of the six `PanelKey` values from `src/lib/integrations/openai/panel-keys.ts`. Null = use the category default from §12. Resolves to R2 `assets/models/{aiModelId}/{runId}/{aiSourcePanel}.png` (see `src/lib/integrations/openai/model-generate.ts:33-34`). |
| `aiFitOverride` | enum or null | When non-null, appends one of the 3 pre-baked sentences in §5 to the Garment Transfer block. |

Detail extension (§5) and set extension (§6) are not inputs —
they are auto-applied:

- Detail extension: **always** appended to the Garment Transfer block.
- Set extension: appended only when `clothingType === 'set'`.

### Image inputs to `gpt-image-2`

Phase 2 is an **image-edit / multi-image** call, not a pure
text-to-image one. The runtime attaches:

1. The resolved model panel (selected by `aiSourcePanel` or its
   category default) — the identity reference.
2. The product's `ai_reference`-role image (a single user-uploaded
   garment-on-white-wall shot; see
   [../per-product-image-gen.md](../per-product-image-gen.md) "Scope").

Both image attachments are referenced in the prompt as "the base
reference image" (identity lock) and "the reference garment image"
(garment transfer) respectively. The order in which they are
attached should match this — identity first, garment second.

### R2 output path

The generated image is written to:

```
products/{YYYY}/{MM}/{DD}/{productId}/ai_model/{uuid}.png
```

(date-partitioned shape, matches `products/.../original/` and
`products/.../ai_reference/`; see
`src/lib/integrations/r2/keys.ts`). The corresponding
`product_images` row carries `role='ai_model'` and is consumed by
the Etsy publish payload.

### `gpt-image-2` call shape

```ts
openai.images.edit({
  model: 'gpt-image-2',
  image: [panelBytes, referenceBytes],
  prompt,
  size: '1024x1536',  // largest portrait gpt-image-2 supports; worker post-upscales to ≥2000px for Etsy listing photo requirements
  quality: 'low',     // cheap during iteration; bump to 'high' once visual quality bar is met
});
```

---

## 14 · Filled example

Concrete UPPER_BODY example for a vintage flannel shirt, model
`Lucía` (assume `aiModelId = m_lucia`, latest run id
`r_2026_05_20`). Inputs:

```ts
{
  aiModelId: 'm_lucia',
  clothingType: 'shirt',          // → {GARMENT_TYPE}='shirt', behavior=UPPER_BODY, sourcePanel default=front_full
  aiPosePreset: 'soft_relaxed',   // global default
  aiFramingPreset: 'waist_up',    // global default
  aiEnvironmentPreset: 'textured_wall', // global default
  aiSourcePanel: null,            // ⇒ resolves to 'front_full' per §12
  aiFitOverride: null,
}
```

Styling block is always present; detail extension is always
appended to Garment Transfer; set extension is omitted
(`clothingType !== 'set'`).

```
Preserve the exact same woman from the base reference image with identical facial structure, body proportions, skin tone, hairstyle, anatomy, and identity. Do not alter the model's face, body shape, height proportions, hands, shoulders, or overall appearance.

The existing base image must remain the foundation of the composition. Only apply the garment naturally onto the existing model while preserving realistic anatomy, natural posture, and original photographic realism.

Apply the provided shirt from the reference garment image onto the existing model while preserving the exact original garment structure, stitching, proportions, folds, wrinkles, fabric texture, buttons, seams, patterns, graphics, fading, wear, and authentic vintage details.

Preserve the exact garment colors and textile behavior from the original garment image. Maintain realistic fabric physics, natural gravity-based draping, believable sleeve tension, realistic fabric bunching, and authentic second-hand garment characteristics.

Do not redesign, reinterpret, modernize, clean up, or stylize the garment.

Preserve the authentic vintage print scale, original textile color fading, realistic woven fabric texture, and natural aged fabric characteristics from the original garment image.

Maintain realistic upper-body garment behavior with natural fabric draping around the shoulders, chest, waist, sleeves, and torso. Preserve authentic fabric tension, realistic folds, soft bunching, sleeve compression, and believable textile weight.

The garment should interact naturally with the model's posture and anatomy while maintaining realistic relaxed vintage clothing behavior, authentic second-hand texture characteristics, and believable casual wear imperfections.

Style the model with subtle vintage-inspired complementary clothing layers and minimal accessories that naturally match the garment's aesthetic, era, color palette, silhouette, and overall mood.

The styling should feel authentic, understated, and naturally assembled by a real person rather than professionally fashion-styled.

Accessories may include subtle vintage jewelry, small earrings, delicate necklaces, simple rings, thin belts, neutral layering basics, or soft lifestyle elements that complement the garment without competing with it.

All additional styling elements must remain visually secondary to the main garment being sold.

Avoid statement accessories, luxury fashion styling, excessive layering, loud colors, oversized jewelry, trend-heavy aesthetics, editorial fashion compositions, or distracting secondary garments.

The primary garment must remain the clear visual focus of the entire image.

Natural relaxed standing posture with subtle human asymmetry, soft shoulder positioning, relaxed arms, natural hand placement, slight weight shift, and believable casual body posture. The pose should feel natural and unintentionally stylish, like a real person casually modeling clothing for a vintage marketplace listing.

Medium lifestyle crop framed from approximately waist level upward, maintaining strong garment visibility, natural composition, and authentic vintage ecommerce photography aesthetics.

Soft natural lifestyle photography near a lightly textured neutral wall with subtle daylight illumination, minimal distractions, soft natural shadows, and clean vintage ecommerce aesthetics.

Ultra realistic humanized ecommerce photography with authentic natural imperfections, realistic textile behavior, subtle asymmetry, believable posture, realistic skin texture, soft natural lighting, and genuine human presence.

The final image should feel like a real vintage clothing listing photographed by a real person for a real marketplace, not like an AI-generated luxury fashion campaign.

Avoid overprocessed skin, artificial perfection, exaggerated posing, editorial fashion aesthetics, cinematic lighting, unrealistic anatomy, distorted hands, distorted garments, excessive beauty retouching, or overly stylized AI aesthetics.
```

Attachments for this call:

1. `assets/models/m_lucia/r_2026_05_20/front_full.png`
2. The product's primary `original`-role R2 image.

---

## 15 · Negative-prompt notes

Unlike Phase 1, Phase 2 has no single trailing "Avoid …"
paragraph. The negatives are spread across several blocks:

- **Garment transfer** — explicit "Do not redesign, reinterpret,
  modernize, clean up, or stylize the garment." Targets the
  model's tendency to "improve" worn-looking clothing.
- **Styling module** — list of styling categories to avoid
  (statement accessories, editorial compositions, etc.) so the
  garment stays the focus.
- **Realism block** — list of failure modes (overprocessed skin,
  artificial perfection, distorted hands and garments, etc.).

Editing any of these three is the leverage point when a specific
failure mode shows up in real outputs.

---

## 16 · Locked decisions

- **Modular composition, fixed block order.** The runtime
  concatenates 8 named blocks; it does not reorder them.
- **Prompts stay in English**, per
  [../project-conventions.md](../project-conventions.md) §2.
- **Two image attachments per call** — identity reference (Phase
  1 panel) first, garment reference (`ai_reference` product image)
  second.
- **`aiSourcePanel` enum mirrors the Phase 1 `PanelKey` set** in
  `src/lib/integrations/openai/panel-keys.ts`. New panels would
  require regenerating the Phase 1 contact sheets.
- **Defaults:** `soft_relaxed` pose, `waist_up` framing,
  `textured_wall` environment, source panel resolved from
  `clothingType` (per §12), `aiFitOverride=null`. Styling block
  always on. Detail extension always appended. Set extension
  auto-applied when `clothingType==='set'`.
- **`aiFitOverride` is an enum**, not freeform —
  `null \| 'tight' \| 'loose' \| 'oversized'` with pre-baked
  sentences (see §5).
- **`{GARMENT_TYPE}` is resolved from the clothing-types registry**
  (`src/lib/products/clothing-types.ts`), not caller-supplied.
- **Module strings are env-overridable per block** via
  `IMAGE_PLACEMENT_{IDENTITY|GARMENT_TRANSFER|GARMENT_DETAIL|BEHAVIOR_UPPER|…|STYLING|POSE_SOFT_RELAXED|…|REALISM}_PROMPT`.
- **Code/DB/input values use lowercase snake_case** (`soft_relaxed`,
  `textured_wall`, …). UPPER_CASE preset names in this doc's section
  headers are mnemonic only.
- **One image per generation.** Regenerate replaces the prior
  `ai_model`-role row; multi-angle fan-out is deferred.
- **`gpt-image-2` call:** `size: '1024x1536'` portrait, post-upscaled
  to ≥2000px to meet Etsy listing photo requirements; `quality: 'low'`
  during iteration, bump to `'high'` once visual bar is met.
- **No `{ETHNICITY}` axis.** Identity comes entirely from the
  attached Phase 1 panel — text-side identity descriptors are
  intentionally not reintroduced here (would conflict with the
  image input).

---

## 17 · Next iterations

Refinements expected once the prompt runs against the live model:

1. Confirm the per-category source-panel defaults in §12 (UPPER_BODY
   → `front_full`, TRENCH_COAT / LOWER_BODY / COMPLETE_GARMENTS →
   `threequarter_full`, SPECIAL_STRUCTURE → `front_full`) hold up
   in practice. The select makes overrides cheap; defaults are
   starting heuristics.
2. Confirm `TRENCH_COAT` works with `threequarter_full` as the
   identity reference. If the angle isn't enough, add a true
   `side_full` panel to Phase 1 (would require regenerating every
   model's contact sheet).
3. Tune the Styling / Accessories block — most subjective; the line
   between "complementary" and "competing" depends on the shop's
   aesthetic and may need shop-specific copy later.
4. Bump `quality` from `'low'` to `'high'` once the prompt produces
   acceptable output at low — costs ~6× more per call.
5. Implementation steps (tracked in
   [../per-product-image-gen.md](../per-product-image-gen.md)):
   1. `src/lib/integrations/openai/image-placement-prompts.ts` —
      8 module constants (+ detail + set extensions) +
      `assembleImagePlacementPrompt`.
   2. `src/lib/integrations/openai/image-placement.ts` — worker
      flow, `openai.images.edit` call, R2 upload, `product_images`
      insert with `role='ai_model'`.
   3. BullMQ queue `ai-image-placement` + worker registration.
   4. Product form `Imagen IA` section (step 1) with model select +
      `ai_reference` uploader + 5 preset selects.
   5. Replace the stub `IMAGE_PLACEMENT` + `LOCATION_POOL` in
      `src/lib/integrations/openai/prompts.ts` once the module
      constants land.

---

## 18 · Open questions

- Should the product form expose all 4 framing presets, or pick
  one based on category and let `close_detail` be a separate
  "generate detail shot" button?
- Post-upscale path: which library / approach gives the best result
  for AI-generated portraits (sharp 1.5×–2× upscale to clear the
  Etsy 2000px bar) — sharp's built-in lanczos, an `Image-Magick`
  pipeline, or a second OpenAI call to `gpt-image-2` with a higher
  size request? Open until the worker is wired.
