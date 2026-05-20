# Phase 1 · Base model generation

The first stage of the [model-generation pipeline](./README.md).
Produces a **single image** containing six consistent views of one
synthetic fashion model. The output is the source-of-truth identity
that every later phase (garment, pose, environment) references.

> Status: prompt drafted, not yet wired into code. Iterate against
> the live `gpt-image-2` model before integrating.

> The original ChatGPT recommendation that seeded this prompt —
> verbatim base prompt, variable list, complete filled example, and
> the guidance about how to construct Phase 2-4 prompts — lives in
> [source-notes.md](./source-notes.md). The structured content in
> this file is a derivative; when in doubt, source-notes is canonical.

---

## 1 · Goal

Create one image that establishes:

- A consistent face, hair, and skin tone across all panels.
- Clean anatomy with no distortions (hands, feet, proportions).
- A neutral, fitting-reference body view that later phases can
  reliably composite garments onto.

Run frequency: **low** (once per "model" added to the shop, not
per product). The outputs are stored under R2 `assets/models/` and
reused across every product enrichment.

---

## 2 · Output shape

A single contact-sheet image organized as 6 panels:

| Panel | View | Purpose |
| --- | --- | --- |
| 1 | Front-facing full body | Garment fit reference (front) |
| 2 | Front-facing portrait close-up | Face identity reference |
| 3 | Front upper-torso close-up | Shoulders-to-abdomen fit + styling reference |
| 4 | Left-side profile portrait | Profile identity reference |
| 5 | Back-facing full body | Back garment fit reference |
| 6 | Front 3/4 angle full body | Three-quarter fit reference |

The reasoning behind 6 panels in one call (rather than 6 separate
generations): `gpt-image-2` preserves identity, hairstyle, skin
tone, and body proportions much more reliably within a single
generation than across multiple generations of the "same" subject.

---

## 3 · Base prompt template

The reusable template with variable placeholders. Variable
interpolation uses the same `{VAR_NAME}` convention as the existing
enrichment prompts in `src/lib/integrations/openai/prompts.ts`.

```
A highly detailed realistic ecommerce fashion reference contact
sheet featuring the same woman consistently across all panels.

The subject is a {AGE_RANGE} european woman with naturally
proportioned {BODY_TYPE} body proportions, approximately
{HEIGHT_RANGE} tall proportions, {SKIN_TONE} skin tone,
{FACE_SHAPE} face shape, and {HAIR_COLOR} {HAIR_TYPE} hair styled
as a {HAIR_SHAPE}.

She looks like a real everyday person rather than a fashion model
— naturally attractive, approachable, believable, and realistic.
Subtle natural asymmetry, authentic skin texture, soft facial
features, slight imperfections, realistic pores, natural
proportions, and relaxed posture.

No exaggerated beauty standards, no glamour model appearance, no
runway model proportions, no idealized facial perfection, no
hyper-symmetry, and no stylized editorial beauty.

The same woman must appear consistently in every panel with
consistent facial structure, body proportions, hairstyle, skin
tone, and identity.

She is wearing a seamless matte opaque full-coverage unitard,
non-sheer fabric, neutral light beige, with no visible logos,
patterns, accessories, jewelry, tattoos, piercings, heavy makeup,
or nail polish.

Minimal natural makeup only. Soft natural lips, realistic
under-eye texture, realistic skin variation, and natural human
facial detail.

Professional ecommerce studio photography in a seamless pure
white infinity backdrop studio environment with soft diffused
lighting, balanced exposure, soft natural shadows, and clean
commercial catalog photography quality.

Shot using realistic commercial apparel photography styling with
accurate body proportions, realistic skin rendering, and natural
photographic detail.

The woman stands in a neutral relaxed standing pose with natural
posture, shoulders relaxed, feet naturally positioned, and arms
slightly separated from the torso for clear body visibility.

The image is organized as a structured professional fashion
reference contact sheet using a fixed 3-column by 2-row grid
layout with equal panel dimensions, symmetrical spacing, and
aligned composition.

Each panel is separated by a clean solid pure-white gutter at
least 40 pixels to a maximum of 60 pixels wide on all sides,
including the outer trim and inner dividers.

The panel order must remain identical and consistent in every
generation, arranged from left to right and top to bottom in the
following exact order:

Panel 1 (top-left): front-facing full body view, entire body visible from head to toe.

Panel 2 (top-center): front-facing portrait close-up view with natural facial detail.

Panel 3 (top-right): front-facing upper-torso close-up view, cropped and framed from shoulders to abdomen.

Panel 4 (bottom-left): left side profile portrait close-up view with detailed facial structure.

Panel 5 (bottom-center): back-facing full body view, entire body visible from head to toe.

Panel 6 (bottom-right): front 3/4 angle full body view for garment fitting reference.

All panels must maintain consistent framing, centered positioning,
equal spacing, identical alignment, and clean white negative
space between panels for reliable automated cropping and
dataset-style reference extraction.

Realistic ecommerce photography, clean composition, centered
framing, believable proportions, natural anatomy, realistic skin
texture, authentic human appearance, and commercial apparel
fitting reference quality.

Avoid glamour photography, editorial fashion styling, exaggerated
curves, stylized anatomy, hyper-perfect faces, unrealistic
symmetry, porcelain skin, excessive beauty retouching, dramatic
posing, cinematic color grading, sexualized posing, distorted
anatomy, artificial body proportions, doll-like appearance, or
influencer-style beauty aesthetics.
```

---

## 4 · Variables

Seven variables drive the identity. Each has a defined value space;
keep additions conservative — every new option is another axis the
model has to nail consistently across 6 panels.

> Ethnicity is **not** a variable. The shop's focus group is
> European, so `european` is hardcoded in the template.

### `{AGE_RANGE}`

The apparent age bracket of the model. Default: `woman in her late 20s`.

| Value | Notes |
| --- | --- |
| `woman in her early 20s` | Youngest end; tend to favor smaller frames. |
| `woman in her late 20s` | Recommended default for vintage clothing. |
| `woman in her early 30s` | Slightly more mature features. |

### `{BODY_TYPE}`

Body proportions descriptor. `gpt-image-2` responds best to
non-glamour language — "naturally proportioned X" beats single
adjectives. Default: `athletic`.

| Value |
| --- |
| `slim` |
| `athletic` |
| `curvy` |

### `{HEIGHT_RANGE}`

Approximate height. Stated as a height descriptor, not a literal
measurement (the model can't render height precisely, but the
phrasing influences proportions). Default: `170cm`.

| Value |
| --- |
| `160cm` |
| `170cm` |
| `180cm` |

### `{FACE_SHAPE}`

Geometric face descriptor. Strong influence on portrait panels.

| Value |
| --- |
| `oval` |
| `heart-shaped` |
| `round` |
| `square` |
| `diamond` |

### `{HAIR_COLOR}`, `{HAIR_SHAPE}`, `{HAIR_TYPE}`

Hair is split into three independent axes. They concatenate in the
template as `{HAIR_COLOR} {HAIR_TYPE} hair styled as a {HAIR_SHAPE}`.
Styles that pull the hair **back** or **up** preserve identity
across panels better than loose hair.

`{HAIR_COLOR}`

| Value |
| --- |
| `blonde` |
| `red` |
| `black` |
| `dark brown` |
| `light brown` |

`{HAIR_SHAPE}`

| Value |
| --- |
| `short bob` |
| `low ponytail` |
| `high ponytail` |
| `updo` |
| `bun` |

`{HAIR_TYPE}`

| Value |
| --- |
| `wavy` |
| `straight` |

### `{SKIN_TONE}`

Default: `fair skin`.

| Value |
| --- |
| `fair skin` |
| `warm tan skin` |

---

## 5 · Filled example

A complete, ready-to-send prompt for a reference European model in
her late 20s. Useful as a sanity check when comparing template
output to the final string.

```
A highly detailed realistic ecommerce fashion reference contact
sheet featuring the same woman consistently across all panels.

The subject is a woman in her late 20s european woman with
naturally proportioned athletic body proportions, approximately
170cm tall proportions, fair skin tone, oval face shape, and
dark brown straight hair styled as a low ponytail.

She looks like a real everyday person rather than a fashion model
— naturally attractive, approachable, believable, and realistic.
Subtle natural asymmetry, authentic skin texture, soft facial
features, slight imperfections, realistic pores, natural
proportions, and relaxed posture.

No exaggerated beauty standards, no glamour model appearance, no
runway model proportions, no idealized facial perfection, no
hyper-symmetry, and no stylized editorial beauty.

The same woman must appear consistently in every panel with
consistent facial structure, body proportions, hairstyle, skin
tone, and identity.

She is wearing a seamless matte opaque full-coverage unitard,
non-sheer fabric, neutral light beige, with no visible logos,
patterns, accessories, jewelry, tattoos, piercings, heavy makeup,
or nail polish.

Minimal natural makeup only. Soft natural lips, realistic
under-eye texture, realistic skin variation, and natural human
facial detail.

Professional ecommerce studio photography in a seamless pure
white infinity backdrop studio environment with soft diffused
lighting, balanced exposure, soft natural shadows, and clean
commercial catalog photography quality.

Shot using realistic commercial apparel photography styling with
accurate body proportions, realistic skin rendering, and natural
photographic detail.

The woman stands in a neutral relaxed standing pose with natural
posture, shoulders relaxed, feet naturally positioned, and arms
slightly separated from the torso for clear body visibility.

The image is organized as a structured professional fashion
reference contact sheet using a fixed 3-column by 2-row grid
layout with equal panel dimensions, symmetrical spacing, and
aligned composition.

Each panel is separated by a clean solid pure-white gutter at
least 40 pixels to a maximum of 60 pixels wide on all sides,
including the outer trim and inner dividers.

The panel order must remain identical and consistent in every
generation, arranged from left to right and top to bottom in the
following exact order:

Panel 1 (top-left): front-facing full body view, entire body visible from head to toe.

Panel 2 (top-center): front-facing portrait close-up view with natural facial detail.

Panel 3 (top-right): front-facing upper-torso close-up view, cropped and framed from shoulders to abdomen.

Panel 4 (bottom-left): left side profile portrait close-up view with detailed facial structure.

Panel 5 (bottom-center): back-facing full body view, entire body visible from head to toe.

Panel 6 (bottom-right): front 3/4 angle full body view for garment fitting reference.

All panels must maintain consistent framing, centered positioning,
equal spacing, identical alignment, and clean white negative
space between panels for reliable automated cropping and
dataset-style reference extraction.

Realistic ecommerce photography, clean composition, centered
framing, believable proportions, natural anatomy, realistic skin
texture, authentic human appearance, and commercial apparel
fitting reference quality.

Avoid glamour photography, editorial fashion styling, exaggerated
curves, stylized anatomy, hyper-perfect faces, unrealistic
symmetry, porcelain skin, excessive beauty retouching, dramatic
posing, cinematic color grading, sexualized posing, distorted
anatomy, artificial body proportions, doll-like appearance, or
influencer-style beauty aesthetics.
```

---

## 6 · Negative prompt (the "Avoid …" tail)

The final paragraph is a negative prompt. The current list targets
the most common failure modes for ecommerce reference imagery:

- Glamour photography / editorial fashion styling / dramatic posing
  → off-brand for vintage / casual shop, also poor fit reference.
- Exaggerated curves / stylized anatomy / artificial body
  proportions / distorted anatomy → distorts later garment
  compositing.
- Hyper-perfect faces / unrealistic symmetry / porcelain skin /
  excessive beauty retouching / doll-like appearance /
  influencer-style beauty aesthetics → break the "real everyday
  person" framing the positive prompt explicitly asks for; subtle
  natural asymmetry and authentic skin texture are required for
  believable fit reference.
- Cinematic color grading → makes skin tone non-canonical and
  breaks consistency across phase outputs.
- Sexualized posing → off-brand and unusable for fit reference.

Editing the negative prompt is a high-leverage way to fix specific
failure modes observed in real outputs; expect to add items here
as we iterate.

---

## 7 · Next iterations

Once the live model is generated and reviewed, expected refinements:

1. Tune `{HAIR_COLOR}` / `{HAIR_SHAPE}` / `{HAIR_TYPE}` phrasing
   based on which combinations actually preserve across all 6 panels.
2. Decide whether to bake `85mm lens portrait compression` into
   the template unconditionally (it's in the filled example but
   not the template — it improved portraits in chat-side tests).
3. Add a `{LENS}` variable if compression style turns out to be
   worth varying.
4. Consider whether to split the prompt into "identity core" +
   "studio shot" so Phase 2 (garment application) can reuse the
   identity core verbatim.

When the prompt stabilizes, the next concrete code step is:

1. Add `BASE_MODEL_GENERATION` to
   `src/lib/integrations/openai/prompts.ts` (env-overridable via
   `BASE_MODEL_GENERATION_PROMPT`, same pattern as the existing
   enrichment prompts).
2. Add a small admin-only screen (under `/settings/models` or
   similar) that takes the seven variables as inputs, calls
   `gpt-image-2`, uploads the result to R2 `assets/models/`, and
   surfaces a preview.
3. Then move on to [phase 2](./README.md#2--phases) (garment
   application).
