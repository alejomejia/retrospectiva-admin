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
| 3 | Left-side profile full body | Side silhouette reference |
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
A highly detailed ultra-realistic ecommerce fashion reference
contact sheet featuring the same woman consistently across all
panels.

The subject is a {AGE_RANGE} {ETHNICITY} woman with {BODY_TYPE}
body proportions, approximately {HEIGHT_RANGE} tall proportions,
{SKIN_TONE} skin tone, {FACE_SHAPE} face shape, and
{HAIR_DESCRIPTION}. She has natural realistic facial features,
symmetrical eyes, realistic hands and feet, accurate anatomy, and
a neutral fashion catalog expression with relaxed lips and soft
eyes.

The same exact woman must appear consistently in every panel with
identical facial structure, body proportions, hairstyle, skin tone,
and identity.

She is wearing a seamless matte neutral beige skin-tight bodysuit
with no visible logos, no patterns, no texture, and no accessories.
No jewelry, no tattoos, no piercings, no heavy makeup, no nail
polish.

Professional luxury ecommerce studio photography, shot in a
seamless pure white infinity backdrop studio environment with soft
diffused high-key lighting, evenly lit skin tones, soft natural
shadows, and commercial fashion photography quality.

Photographed using a Canon EOS R5 with ultra sharp professional
fashion photography detail, realistic skin texture, high dynamic
range, commercial apparel fitting reference photography quality.

The woman stands in a neutral symmetrical standing pose with
straight posture, feet naturally positioned, shoulders relaxed,
and arms slightly separated from the torso for clear body
visibility.

The image is organized as a clean professional multi-panel fashion
reference contact sheet with the following views:

Panel 1: front-facing full body view, entire body visible from
head to toe.

Panel 2: front-facing portrait close-up view with highly detailed
facial features.

Panel 3: left side profile full body view, entire body visible
from head to toe.

Panel 4: left side profile portrait close-up view with detailed
facial structure.

Panel 5: back-facing full body view, entire body visible from
head to toe.

Panel 6: front 3/4 angle full body view for garment fitting
reference.

Ultra realistic ecommerce photography, clean composition, centered
framing, professional studio production quality, realistic
proportions, fashion fit reference photography, apparel fitting
reference model.

Avoid dramatic shadows, editorial fashion lighting, exaggerated
curves, stylized anatomy, glamour photography, sexualized posing,
cinematic color grading, cropped limbs, distorted anatomy,
fisheye distortion, blurry details, inconsistent identity,
asymmetrical facial features, or unrealistic body proportions.
```

---

## 4 · Variables

Seven variables drive the identity. Each has a defined value space;
keep additions conservative — every new option is another axis the
model has to nail consistently across 6 panels.

### `{AGE_RANGE}`

The apparent age bracket of the model.

| Value | Notes |
| --- | --- |
| `woman in her early 20s` | Youngest end; tend to favor smaller frames. |
| `woman in her late 20s` | Recommended default for vintage clothing. |
| `woman in her early 30s` | Slightly more mature features. |
| `woman in her mid 30s` | |
| `woman in her early 40s` | |
| `woman in her mid 40s` | More editorial / mature audience. |

### `{ETHNICITY}`

The ethnic descriptor. Phrases should read naturally in the full
sentence — "of latina ethnicity" or just "latina", both work.

| Value |
| --- |
| `latina` |
| `east asian` |
| `south asian` |
| `nordic` |
| `black african` |
| `middle eastern` |
| `mixed ethnicity` |

### `{BODY_TYPE}`

Body proportions descriptor. `gpt-image-2` responds best to
non-glamour language — "naturally proportioned X" beats single
adjectives.

| Value |
| --- |
| `slim` |
| `athletic` |
| `curvy` |
| `midsize` |
| `petite` |
| `tall slim` |

### `{HEIGHT_RANGE}`

Approximate height. Stated as a height descriptor, not a literal
measurement (the model can't render height precisely, but the
phrasing influences proportions).

| Value |
| --- |
| `160cm` |
| `165cm` |
| `170cm` |
| `175cm` |
| `178cm` |

### `{FACE_SHAPE}`

Geometric face descriptor. Strong influence on portrait panels.

| Value |
| --- |
| `oval` |
| `heart-shaped` |
| `round` |
| `square` |
| `diamond` |

### `{HAIR_DESCRIPTION}`

A short phrase covering color + texture + style. Free-form, but
the format `"{color} {texture} hair {styled into a/tied into a
…}"` performs best.

Examples:

- `dark brown slick back ponytail`
- `black straight shoulder-length hair tied back`
- `blonde clean bun hairstyle`
- `curly dark hair tied into a low ponytail`
- `auburn wavy hair pulled into a loose bun`
- `platinum blonde straight hair pulled back tightly`

Hair styled **back** or **up** preserves identity across panels
better than loose hair — loose hair tends to drift in shape between
front / side / back views.

### `{SKIN_TONE}`

| Value |
| --- |
| `fair skin` |
| `warm olive skin` |
| `warm tan skin` |
| `deep dark skin` |
| `light brown skin` |
| `medium brown skin` |

---

## 5 · Filled example

A complete, ready-to-send prompt for a reference latina model in
her late 20s. Useful as a sanity check when comparing template
output to the final string.

```
A highly detailed ultra-realistic ecommerce fashion reference
contact sheet featuring the same woman consistently across all
panels.

The subject is a woman in her late 20s of latina ethnicity with
naturally proportioned midsize body proportions, approximately
170cm tall proportions, warm olive skin tone, oval face shape,
and dark brown straight hair tied into a clean low ponytail. She
has natural realistic facial features, symmetrical eyes, realistic
hands and feet, accurate anatomy, and a neutral fashion catalog
expression with relaxed lips and soft eyes.

The same exact woman must appear consistently in every panel with
identical facial structure, body proportions, hairstyle, skin tone,
and identity.

She is wearing a seamless matte neutral beige skin-tight bodysuit
with no visible logos, no patterns, no texture, and no accessories.
No jewelry, no tattoos, no piercings, no heavy makeup, no nail
polish.

Professional luxury ecommerce studio photography, shot in a
seamless pure white infinity backdrop studio environment with soft
diffused high-key lighting, evenly lit skin tones, soft natural
shadows, and commercial fashion photography quality.

Photographed using a Canon EOS R5 with ultra sharp professional
fashion photography detail, realistic skin texture, high dynamic
range, 85mm lens portrait compression, commercial apparel fitting
reference photography quality.

The woman stands in a neutral symmetrical standing pose with
straight posture, feet naturally positioned, shoulders relaxed,
and arms slightly separated from the torso for clear body
visibility.

The image is organized as a clean professional multi-panel fashion
reference contact sheet with the following views:

Panel 1: front-facing full body view, entire body visible from
head to toe.

Panel 2: front-facing portrait close-up view with highly detailed
facial features.

Panel 3: left side profile full body view, entire body visible
from head to toe.

Panel 4: left side profile portrait close-up view with detailed
facial structure.

Panel 5: back-facing full body view, entire body visible from
head to toe.

Panel 6: front 3/4 angle full body view for garment fitting
reference.

Ultra realistic ecommerce photography, clean composition, centered
framing, professional studio production quality, realistic
proportions, fashion fit reference photography, apparel fitting
reference model.

Avoid dramatic shadows, editorial fashion lighting, exaggerated
curves, stylized anatomy, glamour photography, sexualized posing,
cinematic color grading, cropped limbs, distorted anatomy,
fisheye distortion, blurry details, inconsistent identity,
asymmetrical facial features, or unrealistic body proportions.
```

---

## 6 · Negative prompt (the "Avoid …" tail)

The final paragraph is a negative prompt. The current list targets
the most common failure modes for ecommerce reference imagery:

- Dramatic / editorial lighting → flattens fit visibility.
- Exaggerated curves / stylized anatomy → distorts later garment
  compositing.
- Glamour or sexualized posing → off-brand for vintage / casual
  shop, also poor fit reference.
- Cinematic color grading → makes skin tone non-canonical and
  breaks consistency across phase outputs.
- Cropped limbs / fisheye / distortion → unusable for full-body
  fitting.
- Inconsistent identity / asymmetric features → the primary
  failure mode this phase exists to prevent.

Editing the negative prompt is a high-leverage way to fix specific
failure modes observed in real outputs; expect to add items here
as we iterate.

---

## 7 · Next iterations

Once the live model is generated and reviewed, expected refinements:

1. Tune `{HAIR_DESCRIPTION}` phrasing based on which patterns
   actually preserve across all 6 panels.
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
