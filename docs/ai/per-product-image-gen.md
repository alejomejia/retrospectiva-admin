# Per-product on-model image generation (Task 11)

**Status: plan locked with the user, implementation not started.**

This is the next active task per the handoff. The Model Studio
(Task 8) generates and curates synthetic models; this task consumes
one of those saved models + user-uploaded reference imagery to
produce an on-model image attached to the product.

> Read [model-generation/](./model-generation/README.md) first for
> the pipeline phases context, and [handoff.md](../overview/handoff.md) for
> what just shipped.

---

## Scope

**In v1:**
- New **Imagen IA** section at the bottom of step 1 (after media uploader).
- 6 user-controllable variables on each product (model, source panel, pose, framing, environment, fit override).
- Single AI reference image uploader (garment-on-white-wall, NOT included in Etsy publish).
- On-demand generation via **"Generar imagen"** button — produces a `gpt-image-2` call with 2 input images, drops the result into `product_images` with `role='ai_model'`.
- Regenerar / hard-delete-prior-ai_model.
- Schema cleanup: drop legacy `ai_runs.kind` values that were replaced by `enrich` (user is in dev phase — no real data to preserve).

**Deferred:**
- Shop-wide defaults page (`/settings/ai`) — schema sketched below, UI in a follow-up.
- Edit-form parity for already-published products — the section component will be designed for reuse but only mounted in step 1 for v1.
- Etsy publish integration of the AI image — Phase 4c work.

---

## Schema (single migration)

```ts
// products: 6 new columns
products.aiModelId              uuid REFERENCES ai_models(id) ON DELETE SET NULL  // null = "no AI image for this product"
products.aiSourcePanel          text          // one of PANEL_ORDER; null = "use category default" (see §Source-panel defaults)
products.aiPosePreset           text DEFAULT 'soft_relaxed'
products.aiFramingPreset        text DEFAULT 'waist_up'
products.aiEnvironmentPreset    text DEFAULT 'textured_wall'
products.aiFitOverride          text                               // nullable: null | 'tight' | 'loose' | 'oversized'

// image_role enum gains 'ai_reference' (input-only; excluded from publish payload)
image_role: 'original' | 'ai_model' | 'ai_reference' | 'thumbnail'

// ai_runs.kind cleanup — drop legacy values, keep what's actually used
ai_runs.kind: 'enrich' | 'translation' | 'model_generation' | 'model_placement'
//                                                            ↑ used here for these runs
```

Validation lives at the app layer via zod enums (not Postgres
enums) so prompt iteration doesn't need migrations. Use the new
`model_placement` enum value for these runs (it already exists in
the current `ai_run_kind` enum from earlier schema work — survives
the cleanup).

**Drop these legacy `ai_run_kind` values in the migration** since
no rows exist with them and they were replaced by `enrich`:
- `description`, `era`, `title`, `tags`, `materials`, `taxonomy`, `when_made`

**Future shop-wide settings table** (sketched, NOT in v1):
```ts
shop_settings (single row):
  aiDefaultModelId            uuid → ai_models.id
  aiDefaultSourcePanel        text
  aiDefaultPosePreset         text
  aiDefaultFramingPreset      text
  aiDefaultEnvironmentPreset  text
  markupPercent               smallint  // candidate to migrate from etsy_oauth
```

When this lands, per-product columns switch to NULL-means-inherit.
For v1 hard-coded defaults are fine.

---

## R2 layout

Same date-partitioned shape as existing product media:
```
products/{YYYY}/{MM}/{DD}/{productId}/ai_reference/{uuid}.jpg  ← user-uploaded, single
products/{YYYY}/{MM}/{DD}/{productId}/ai_model/{uuid}.png      ← AI output, single
```

`role='ai_reference'` images are filtered out of the publish payload
(future Etsy publish code only looks for `original` + `ai_model`).

---

## Prompt assembly

Single module: `src/lib/integrations/openai/image-placement-prompts.ts`.
Exports each of the 8 module-paragraph constants verbatim from the
spec below + an `assembleImagePlacementPrompt(input)` function:

```ts
function assembleImagePlacementPrompt({
  clothingType,         // 'dress' | 'jean' | 'set' | …  → drives module 3 + GARMENT_TYPE
  fitOverride,          // null | 'tight' | 'loose' | 'oversized'
  posePreset,           // 'soft_relaxed' | 'soft_movement' | 'structured_posture'
  framingPreset,        // 'waist_up' | 'thighs_up' | 'full_body' | 'close_detail'
  environmentPreset,    // 'textured_wall' | 'minimal_apartment' | 'soft_studio' | 'vintage_home' | 'window_light'
}): string
```

The function joins, in order, **exactly one block per module** from
{identity, garment-transfer, behavior, **styling**, pose, framing,
environment, realism}, separated by `\n\n`. Special cases:

1. **Garment behavior auto-mapping** from `clothingType`:
   - `shirt | vest | top | sweater | jacket` → §3.1
   - `trench_coat` → §3.2
   - `corset` → §3.3
   - `jean | pant | skirt | short` → §3.4
   - `set | overall | dress | bodysuit` → §3.5
   - **`set` additionally appends §3.5.1** (only case where two blocks come from one module)

2. **Detail extension (always-on)**: a second paragraph is appended to the Garment Transfer block on every call. Preserves print scale / fading / weave detail. Constant lives next to Module 2 (see §2.1 below).

3. **Fit override**: when non-null, appends a short sentence to the Garment Transfer block (after the detail extension). Three pre-baked options:
   - `tight`: "Apply a tight body-hugging fit with realistic fabric tension and natural compression points."
   - `loose`: "Apply a loose relaxed fit with generous fabric volume and natural draping."
   - `oversized`: "Apply an oversized fit with intentional excess fabric, relaxed proportions, and authentic vintage layering."
   - `null` (default): line omitted entirely.

`{GARMENT_TYPE}` is filled from the i18n English label for
`clothingType` (e.g. `trench_coat` → "trench coat", `set` →
"two-piece set"). The full English mapping lives in
`clothing-types.ts` (add a new field; today the registry only has
Spanish labels via i18n).

Every block constant is env-overridable via
`IMAGE_PLACEMENT_{IDENTITY|GARMENT_TRANSFER|GARMENT_DETAIL|BEHAVIOR_UPPER|…|STYLING|POSE_SOFT_RELAXED|…|REALISM}_PROMPT` —
same pattern as `BASE_MODEL_GENERATION_PROMPT`.

### Source-panel defaults

`aiSourcePanel` is a UI select; when the user hasn't picked one
(`null` in DB), the worker resolves it from `clothingType`:

| Garment behavior category | Default panel |
| --- | --- |
| Upper body (`shirt`, `vest`, `top`, `sweater`, `jacket`) | `front_full` |
| Trench coat (`trench_coat`) | `threequarter_full` |
| Special structure (`corset`) | `front_full` |
| Lower body (`jean`, `pant`, `skirt`, `short`) | `threequarter_full` |
| Complete garments (`set`, `overall`, `dress`, `bodysuit`) | `threequarter_full` |

The select is pre-populated with the category default but the user
can override per product if a different angle reads better.

---

## File map

**New:**
- `src/lib/integrations/openai/image-placement-prompts.ts` — the 8 module constants (+ Module 2.1 detail extension + Module 3.5.1 set extension) + `assembleImagePlacementPrompt`.
- `src/lib/integrations/openai/image-placement.ts` — `runImagePlacement(productId)`. Loads product, downloads model panel + AI reference from R2, calls `openai.images.edit({ image: [panel, reference], prompt, … })`, uploads result, inserts `product_images` row (after hard-deleting any prior `ai_model` row), logs `ai_runs`.
- `src/lib/integrations/openai/image-placement-worker.ts` — BullMQ glue.
- `src/lib/products/image-placement-actions.ts` — server actions: `generateProductImage(productId, force?)`, `clearAiReferenceImage(productId)`, etc.
- `src/components/forms/new-product/ai-image-section.tsx` — the new step-1 section component (designed for reuse in the edit form later).
- `src/components/forms/new-product/use-image-placement-status.ts` — polling hook.
- `src/app/(admin)/products/[id]/ai-image-status/route.ts` — polling endpoint (mirrors `/ai-status` for enrich + `/generation-status` for model studio).
- Tests for `assembleImagePlacementPrompt` + `runImagePlacement`.

**Modified:**
- `src/lib/db/schema.ts` — 6 new product columns, image_role enum extension, ai_runs.kind cleanup.
- `src/lib/queue/queues.ts` — `aiImagePlacementQueue` + `AiImagePlacementJob`.
- `src/lib/queue/worker.ts` — register new worker.
- `src/lib/products/clothing-types.ts` — add English-label mapping for `{GARMENT_TYPE}` interpolation.
- `src/lib/products/draft-actions.ts` — handle the new AI columns in `updateProductDraftField`.
- `src/lib/products/draft-schema.ts` — zod for the new fields.
- `src/components/forms/new-product/step-1-inputs.tsx` — render the new section at the bottom.
- `src/lib/i18n/messages.en.ts` — labels for all the new selects + button text.

---

## UI: the "Imagen IA" section

Bottom of step 1, after the media uploader. One card with:

```
┌─────────────────────────────────────────────────────────┐
│ Imagen IA                                              │
│ Genera una imagen del producto en una modelo IA.       │
│                                                         │
│ Modelo IA       [ Lucía · latina, late 20s     ▾ ]     │
│ ┌──────────────┐   ← preview of front_portrait crop    │
│ │   [face]     │                                       │
│ └──────────────┘                                       │
│                                                         │
│ Imagen de referencia (colgada en pared blanca)         │
│ [ dropzone — single image ]                            │
│                                                         │
│ Panel del modelo  [ (auto por categoría)  ▾ ]          │
│ Pose              [ Relajada              ▾ ]          │
│ Encuadre          [ De cintura para arriba ▾ ]         │
│ Entorno           [ Pared con textura     ▾ ]          │
│ Ajuste            [ (ninguno)             ▾ ]          │
│                                                         │
│ [ Generar imagen ]                                     │
│                                                         │
│ ┌───────────────────────────┐                           │
│ │  generated image preview  │   ← when present         │
│ └───────────────────────────┘                           │
│ [ Regenerar ]                                          │
└─────────────────────────────────────────────────────────┘
```

The button is disabled until **model is selected AND reference
image is uploaded**. Without those two, the section is effectively
a no-op and the product can publish without an AI image.

Polling pattern matches the existing two (Model Studio + enrich):
skeleton while running, image renders on success, FailureBanner on
failure with Retry + Discard.

---

## Defaults (locked)

| Variable | Default |
|---|---|
| `aiModelId` | null (no auto-pick) |
| `aiSourcePanel` | null in DB; resolved at worker time from `clothingType` category (see Source-panel defaults table above) |
| `aiPosePreset` | `soft_relaxed` |
| `aiFramingPreset` | `waist_up` |
| `aiEnvironmentPreset` | `textured_wall` |
| `aiFitOverride` | null |

---

## Worker flow

1. Load product + selected `ai_models` row + ai_reference image row.
2. Validate: `aiModelId` set, `ai_reference` image exists, model is `active`, the selected panel key is non-null (`cropsAvailable=true` for non-`contact_sheet` panels).
3. Download panel bytes from R2 (`publicUrlFor(model.{selectedPanel}Key)` → `fetch`).
4. Download reference bytes from R2.
5. Assemble prompt via `assembleImagePlacementPrompt`.
6. `openai.images.edit({ model: gpt-image-2, image: [panelBytes, referenceBytes], prompt, size: '1024x1536' /* portrait, largest gpt-image-2 portrait — Etsy listing photos want ≥2000px on the long edge, so the worker post-processes a sharp upscale before R2 upload */, quality: 'low' /* ship cheap until visual quality bar is met, then bump to 'high' */ })`.
7. Download output bytes.
8. Hard-delete any existing `product_images` row with `role='ai_model'` for this product (+ delete R2 object).
9. Upload new image to R2, insert `product_images` row with `role='ai_model'`, `order = MAX(order) + 1`.
10. Bump `products.updatedAt`, log `ai_runs` with `kind='model_placement'` and accurate cost via `estimateImageCostUsd`.

---

## Test strategy

- `image-placement-prompts.test.ts` — every clothing-type maps to the right behavior block; set garments include 3.5 + 3.5.1; detail extension (2.1) always appended to Module 2; styling block always present; fit-override on/off; defaults produce the canonical 8-block layout; no module ever emits two blocks (except set + the always-appended 2.1).
- `image-placement.test.ts` — mock `openai.images.edit`, `uploadToR2`, `fetch` (R2 downloads). Assert: skipped when ai_model_id null; called with both input images when set; hard-deletes prior ai_model; inserts new product_images row at correct order; logs run with `kind='model_placement'`.
- `draft-actions.test.ts` — extend existing tests to cover the new AI columns being settable via the autosave patch.

---

## The 7 prompt modules (verbatim — user's spec, English only)

These are stored as constants in
`src/lib/integrations/openai/image-placement-prompts.ts`. `--` lines
in the original are commentary and not included.

### Module 1 · Identity Lock (always)

> Preserve the exact same woman from the base reference image with identical facial structure, body proportions, skin tone, hairstyle, anatomy, and identity. Do not alter the model's face, body shape, height proportions, hands, shoulders, or overall appearance.
>
> The existing base image must remain the foundation of the composition. Only apply the garment naturally onto the existing model while preserving realistic anatomy, natural posture, and original photographic realism.

### Module 2 · Garment Transfer (always)

> Apply the provided `{GARMENT_TYPE}` from the reference garment image onto the existing model while preserving the exact original garment structure, stitching, proportions, folds, wrinkles, fabric texture, buttons, seams, patterns, graphics, fading, wear, and authentic vintage details.
>
> Preserve the exact garment colors and textile behavior from the original garment image. Maintain realistic fabric physics, natural gravity-based draping, believable sleeve tension, realistic fabric bunching, and authentic second-hand garment characteristics.
>
> Do not redesign, reinterpret, modernize, clean up, or stylize the garment.
>
> `{FIT_OVERRIDE — appended only when non-null, see "Fit override" above}`

### Module 2.1 · Garment Detail Extension (always, appended to Module 2)

> Preserve the authentic vintage print scale, original textile color fading, realistic woven fabric texture, and natural aged fabric characteristics from the original garment image.

### Module 3 · Garment Behavior (one of these, auto-selected)

**3.1 Upper body** (shirt, vest, top, sweater, jacket):

> Maintain realistic upper-body garment behavior with natural fabric draping around the shoulders, chest, waist, sleeves, and torso. Preserve authentic fabric tension, realistic folds, soft bunching, sleeve compression, and believable textile weight.
>
> The garment should interact naturally with the model's posture and anatomy while maintaining realistic relaxed vintage clothing behavior, authentic second-hand texture characteristics, and believable casual wear imperfections.

**3.2 Trench coat**:

> Maintain realistic trench coat weight, vertical draping, layered outerwear structure, natural sleeve volume, and believable long-garment fabric gravity. Preserve authentic oversized silhouette behavior, realistic coat movement, natural open-front layering behavior, and subtle heavy-fabric tension.
>
> The trench coat should feel naturally worn with realistic lower-body draping, soft movement, and believable vintage outerwear structure without exaggerated fashion-editorial posing.

**3.3 Corset**:

> Maintain realistic corset structure, authentic fabric tension, natural compression behavior, and believable body contour interaction. Preserve the exact corset shape, boning structure, stitching, tightening behavior, and realistic textile rigidity without distorting anatomy.
>
> The corset should feel naturally worn with subtle realistic fabric tension around the torso, believable shaping behavior, and authentic vintage garment structure while maintaining realistic human proportions and soft natural posture.

**3.4 Lower body** (jean, skirts, shorts, pants):

> Maintain realistic lower-body garment behavior with authentic fabric interaction around the waist, hips, thighs, knees, and legs. Preserve natural folds, believable compression points, realistic draping, subtle bunching, and authentic second-hand textile behavior.
>
> The garment should respond naturally to posture, gravity, and body positioning while maintaining believable vintage wear patterns, realistic silhouette flow, and authentic fabric tension.

**3.5 Complete garments** (set, overall, dress, bodysuit):

> Maintain realistic full-body garment behavior with natural fabric flow across the upper and lower body, believable silhouette transitions, authentic textile draping, and realistic body movement interaction.
>
> Preserve natural garment continuity, realistic folds, subtle fabric tension, believable gravity behavior, and authentic vintage texture characteristics throughout the entire outfit.
>
> The garment should feel naturally worn and realistically fitted without exaggerated perfection or artificial fashion-editorial styling.

**3.5.1 Additional ONLY for `set`** (appended to 3.5):

> Preserve the coordinated relationship between all garment pieces, including matching fabric behavior, proportional consistency, textile continuity, and authentic outfit balance.

### Module 4 · Styling / Accessories (always)

> Style the model with subtle vintage-inspired complementary clothing layers and minimal accessories that naturally match the garment's aesthetic, era, color palette, silhouette, and overall mood.
>
> The styling should feel authentic, understated, and naturally assembled by a real person rather than professionally fashion-styled.
>
> Accessories may include subtle vintage jewelry, small earrings, delicate necklaces, simple rings, thin belts, neutral layering basics, or soft lifestyle elements that complement the garment without competing with it.
>
> All additional styling elements must remain visually secondary to the main garment being sold.
>
> Avoid statement accessories, luxury fashion styling, excessive layering, loud colors, oversized jewelry, trend-heavy aesthetics, editorial fashion compositions, or distracting secondary garments.
>
> The primary garment must remain the clear visual focus of the entire image.

### Module 5 · Pose (one of these, user-selected; default `soft_relaxed`)

**5.1 Soft relaxed** (default):

> Natural relaxed standing posture with subtle human asymmetry, soft shoulder positioning, relaxed arms, natural hand placement, slight weight shift, and believable casual body posture. The pose should feel natural and unintentionally stylish, like a real person casually modeling clothing for a vintage marketplace listing.

**5.2 Soft movement**:

> Subtle natural body movement with relaxed posture, gentle motion in the arms and torso, and believable casual lifestyle energy. Maintain realistic fabric movement without exaggerated fashion posing.

**5.3 Structured posture**:

> Confident upright posture with subtle relaxed elegance, minimal movement, natural arm positioning, and clear garment visibility while maintaining a believable human stance.

### Module 6 · Framing (one of these, user-selected; default `waist_up`)

**6.1 Waist up** (default):

> Medium lifestyle crop framed from approximately waist level upward, maintaining strong garment visibility, natural composition, and authentic vintage ecommerce photography aesthetics.

**6.2 Thighs up**:

> Lifestyle fashion crop framed from mid-thigh upward with balanced visibility of the garment silhouette, natural body proportions, and casual ecommerce photography composition.

**6.3 Full body**:

> Full body vertical composition with realistic proportions, natural stance, and clean visibility of the entire garment while maintaining relaxed lifestyle realism.

**6.4 Close detail**:

> Closer editorial-style garment framing focused on textile detail, upper body styling, and realistic fabric texture while preserving believable lifestyle photography realism.

### Module 7 · Environment (one of these, user-selected; default `textured_wall`)

**7.1 Textured wall** (default):

> Soft natural lifestyle photography near a lightly textured neutral wall with subtle daylight illumination, minimal distractions, soft natural shadows, and clean vintage ecommerce aesthetics.

**7.2 Minimal apartment**:

> Minimal warm apartment interior with soft natural daylight, subtle furniture presence, neutral tones, and believable lived-in atmosphere without distracting from the garment.

**7.3 Soft studio**:

> Clean soft studio environment with subtle natural shadows, neutral tones, diffused daylight-style illumination, and realistic professional ecommerce photography atmosphere.

**7.4 Vintage home**:

> Subtle vintage-inspired home environment with soft natural lighting, warm neutral textures, minimal visual distractions, and authentic cozy lifestyle realism.

**7.5 Window light**:

> Soft window-side natural lighting with realistic daylight falloff, gentle shadows, warm natural atmosphere, and believable candid lifestyle photography aesthetics.

### Module 8 · Realism Block (always)

> Ultra realistic humanized ecommerce photography with authentic natural imperfections, realistic textile behavior, subtle asymmetry, believable posture, realistic skin texture, soft natural lighting, and genuine human presence.
>
> The final image should feel like a real vintage clothing listing photographed by a real person for a real marketplace, not like an AI-generated luxury fashion campaign.
>
> Avoid overprocessed skin, artificial perfection, exaggerated posing, editorial fashion aesthetics, cinematic lighting, unrealistic anatomy, distorted hands, distorted garments, excessive beauty retouching, or overly stylized AI aesthetics.

---

## Example assembled prompt (with defaults + jacket clothing type)

```
[Module 1 — Identity Lock]

[Module 2 — Garment Transfer with {GARMENT_TYPE}="jacket", no fit override]
[Module 2.1 — Garment Detail Extension (always appended)]

[Module 3.1 — Upper-body Behavior]

[Module 4 — Styling / Accessories]

[Module 5.1 — Soft Relaxed Pose]

[Module 6.1 — Waist-up Framing]

[Module 7.1 — Textured Wall Environment]

[Module 8 — Realism Block]
```
