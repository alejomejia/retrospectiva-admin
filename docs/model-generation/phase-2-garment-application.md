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
| `{GARMENT_TYPE}` | yes | Short noun phrase: `shirt`, `vest`, `trench coat`, `corset`, `jean`, `skirt`, `dress`, `overall`, `set`. Matches the garment-category mapping in §12. |
| `{FIT_OVERRIDE}` | no | Optional sentence that nudges fit (e.g. `Maintain a relaxed oversized fit on the upper body.`). When omitted, the runtime inserts an empty string — do not leave the literal `{FIT_OVERRIDE}` in the output. |

### Module

```
Apply the provided {GARMENT_TYPE} from the reference garment image onto the existing model while preserving the exact original garment structure, stitching, proportions, folds, wrinkles, fabric texture, buttons, seams, patterns, graphics, fading, wear, and authentic vintage details.

Preserve the exact garment colors and textile behavior from the original garment image. Maintain realistic fabric physics, natural gravity-based draping, believable sleeve tension, realistic fabric bunching, and authentic second-hand garment characteristics.

Do not redesign, reinterpret, modernize, clean up, or stylize the garment.

{FIT_OVERRIDE}
```

### Optional detail extension

Append when the garment has prints, graphics, or notable fade /
weave texture (controlled by the `detailExtension` flag in §10).

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

### Optional set extension

Append when category is `COMPLETE_GARMENTS` and the listing is a
multi-piece set (controlled by the `setExtension` flag in §10).

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

## 12 · Category → preset mapping

The default routing the runtime should apply when the caller
specifies only the garment category. Manual overrides on any
individual preset are allowed.

```json
{
  "UPPER_BODY": {
    "behavior": "UPPER_BODY",
    "pose": "SOFT_RELAXED",
    "framing": "WAIST_UP",
    "baseImage": "front_full OR threequarter_full"
  },
  "TRENCH_COAT": {
    "behavior": "TRENCH_COAT",
    "pose": "SOFT_MOVEMENT",
    "framing": "THIGHS_UP OR FULL_BODY",
    "baseImage": "side_portrait OR threequarter_full"
  },
  "SPECIAL_STRUCTURE": {
    "behavior": "SPECIAL_STRUCTURE",
    "pose": "STRUCTURED_POSTURE",
    "framing": "WAIST_UP",
    "baseImage": "front_full"
  },
  "LOWER_BODY": {
    "behavior": "LOWER_BODY",
    "pose": "SOFT_RELAXED",
    "framing": "THIGHS_UP",
    "baseImage": "front_full OR threequarter_full"
  },
  "COMPLETE_GARMENTS": {
    "behavior": "COMPLETE_GARMENTS",
    "pose": "SOFT_MOVEMENT",
    "framing": "FULL_BODY OR THIGHS_UP",
    "baseImage": "threequarter_full"
  }
}
```

> The original recommendation listed `side_full` as a `baseImage`
> for `TRENCH_COAT`. The Phase 1 contact sheet does not produce a
> full-body side panel — it produces `side_portrait` (head/shoulders
> only). The mapping above substitutes `side_portrait` and falls
> back to `threequarter_full` for cases where the lower body needs
> to be visible. Revisit if iteration shows we need a true
> full-body side panel; that would require adding a 7th panel to
> the Phase 1 contact sheet rather than re-cropping the existing one.

---

## 13 · App input contract

What the runtime expects from the caller. Required vs optional
mirrors the original recommendation.

### Required

```json
{
  "garmentType": "",
  "garmentCategory": "",
  "baseImage": "",
  "environmentPreset": "",
  "posePreset": "",
  "framingPreset": ""
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `garmentType` | string | Interpolated into `{GARMENT_TYPE}`. |
| `garmentCategory` | enum | `UPPER_BODY` \| `TRENCH_COAT` \| `SPECIAL_STRUCTURE` \| `LOWER_BODY` \| `COMPLETE_GARMENTS`. Drives §6 + §12 routing. |
| `baseImage` | enum | One of the six `PanelKey` values from `src/lib/integrations/openai/panel-keys.ts` (`front_full`, `front_portrait`, `front_editorial`, `side_portrait`, `back_full`, `threequarter_full`). Resolves to an R2 object under `assets/models/{modelId}/{runId}/{baseImage}.png` (see [model-studio.md §5](./model-studio.md) and `src/lib/integrations/openai/model-generate.ts`). |
| `environmentPreset` | enum | One of §10. |
| `posePreset` | enum | One of §8. |
| `framingPreset` | enum | One of §9. |

### Optional

```json
{
  "fitOverride": "",
  "detailExtension": true,
  "setExtension": false
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `fitOverride` | string | Sentence interpolated into `{FIT_OVERRIDE}`. Empty string ⇒ block is dropped. |
| `detailExtension` | bool | Append §5 detail extension when the garment has notable prints / weave / fading. |
| `setExtension` | bool | Append §6 set extension when category is `COMPLETE_GARMENTS` and the listing is a multi-piece outfit. |

### Image inputs to `gpt-image-2`

Phase 2 is an **image-edit / multi-image** call, not a pure
text-to-image one. The runtime attaches:

1. The resolved base-image panel (selected by `baseImage`) — the
   identity reference.
2. The garment photo from the product's `product_images` rows
   (role = `original`).

Both image attachments are referenced in the prompt as "the base
reference image" (identity lock) and "the reference garment image"
(garment transfer) respectively. The order in which they are
attached should match this — identity first, garment second.

---

## 14 · Filled example

Concrete UPPER_BODY example for a vintage flannel shirt, model
`Lucía` (assume model id `m_lucia`, latest run id `r_2026_05_20`,
panel `front_full`). Defaults applied: `SOFT_RELAXED` pose,
`WAIST_UP` framing, `TEXTURED_WALL` environment, styling on,
`detailExtension` on, no `fitOverride`.

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
  1 panel) first, garment reference (product photo) second.
- **`baseImage` enum mirrors the Phase 1 `PanelKey` set** in
  `src/lib/integrations/openai/panel-keys.ts`. New panels would
  require regenerating the Phase 1 contact sheets.
- **Default presets** match the original recommendation:
  `SOFT_RELAXED` pose, `WAIST_UP` framing, `TEXTURED_WALL`
  environment, styling module on, `detailExtension` on,
  `setExtension` off.
- **No `{ETHNICITY}` axis.** Identity comes entirely from the
  attached Phase 1 panel — text-side identity descriptors are
  intentionally not reintroduced here (would conflict with the
  image input).

---

## 17 · Next iterations

Before wiring this into code, expect the following refinements as
the prompt is tested live:

1. Verify which `baseImage` panel actually works best per category
   — the recommended `front_full OR threequarter_full` is a
   starting heuristic, not a measured result.
2. Confirm `TRENCH_COAT` works with `side_portrait` as the
   identity reference (it crops out the lower body the trench
   coat is meant to drape over). If it doesn't, add a true
   `side_full` panel to Phase 1.
3. Tune the `STYLING_ACCESSORIES_MODULE` — it's the most
   subjective block; the line between "complementary" and
   "competing" depends on the shop's aesthetic and may need
   shop-specific copy later.
4. Decide whether `fitOverride` is exposed in the product form
   v1 or hidden behind an "advanced" toggle.
5. Once stable, the next concrete code steps are:
   1. Add `GARMENT_APPLICATION` block constants to
      `src/lib/integrations/openai/prompts.ts` (env-overridable,
      same pattern as the enrichment prompts and the Phase 1
      `BASE_MODEL_GENERATION` prompt).
   2. Add an assembly helper that composes the 8 blocks given
      the app inputs in §13.
   3. Add a new BullMQ queue + worker (`ai-image-placement` is
      already referenced in `../ai-enrichment.md §6`).
   4. Surface the inputs on the product form — model selector
      (`Aleatorio` default per [model-studio.md §7](./model-studio.md))
      + category/pose/framing/environment selects.

---

## 18 · Open questions

- Should `detailExtension` and `setExtension` be auto-inferred
  (e.g. detail-on when the product has tagged `prints` /
  `graphic-tee` attributes) or always explicit toggles?
- Should the product form expose all 4 framing presets, or pick
  one based on category and let `CLOSE_DETAIL` be a separate
  "generate detail shot" button?
- How many image variants per product by default? The pasted
  system describes 1 image per call, but listings often want
  ~3-4 angles. Likely answer: call the prompt N times with
  different `framingPreset` / `posePreset` combinations. Worth
  picking a default fan-out before implementation.
