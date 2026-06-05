# Source notes — original ChatGPT recommendation

This file preserves the **original ChatGPT recommendation** that
seeded the model-generation work, including all the guidance about
how to structure phases 2–4. The structured docs
([README.md](./README.md), [phase-1-base-model.md](./phase-1-base-model.md),
[model-studio.md](./model-studio.md)) are derivatives of this — when
those structured docs and this source note disagree, this is the
canonical reference for prompt-crafting intent.

The original conversation was in Spanish; the meta-commentary below
is translated to English for consistency with the rest of `docs/`,
per [project-conventions.md](../../overview/project-conventions.md) §2. **The
prompt content itself was provided in English by ChatGPT and is
preserved verbatim.**

---

## Final recommendation for the complete flow

### Phase 1 — Base model generation (this prompt)

**Goal:**

- Create a consistent identity
- Clean anatomy
- Body reference
- Multi-angle pack

**Output:**

- Contact sheet / grid with multiple views

---

### Phase 2 — Garment application (later)

**Goal:**

- Apply clothing
- Adjust fit
- Maintain identity

---

### Phase 3 — Pose transformation (later)

**Goal:**

- Natural poses
- Movement
- Lifestyle
- Social-media feeling

---

### Phase 4 — Environment generation (later)

**Goal:**

- Cafés
- Streets
- Interiors
- Editorial ecommerce
- Mirror selfies
- Candid photos

---

## What is MOST recommended for the base prompt

**Generate EVERYTHING in a single contact-sheet image.**

Very important.

Example:

- 6 panels
- same woman
- same lighting
- same proportions

Because `gpt-image-2`:

- maintains identity much better
- avoids facial changes
- preserves body / hair

This is MUCH better than generating separate images.

---

## Layout recommendation

**6-panel contact sheet**

Panels:

1. Front full body
2. Front portrait
3. Left side full body
4. Left side portrait
5. Back full body
6. 3/4 angle full body

This is ideal for:

- try-on
- fitting
- ecommerce
- later social-pose generation

---

## Main base prompt (template with variables)

This would be the main reusable prompt.

---

```
A highly detailed ultra-realistic ecommerce fashion reference contact sheet featuring the same woman consistently across all panels.

The subject is a {AGE_RANGE} year old {ETHNICITY} woman with {BODY_TYPE} body proportions, approximately {HEIGHT_RANGE} tall proportions, {SKIN_TONE} skin tone, {FACE_SHAPE} face shape, and {HAIR_DESCRIPTION}. She has natural realistic facial features, symmetrical eyes, realistic hands and feet, accurate anatomy, and a neutral fashion catalog expression with relaxed lips and soft eyes.

The same exact woman must appear consistently in every panel with identical facial structure, body proportions, hairstyle, skin tone, and identity.

She is wearing a seamless matte neutral beige skin-tight bodysuit with no visible logos, no patterns, no texture, and no accessories. No jewelry, no tattoos, no piercings, no heavy makeup, no nail polish.

Professional luxury ecommerce studio photography, shot in a seamless pure white infinity backdrop studio environment with soft diffused high-key lighting, evenly lit skin tones, soft natural shadows, and commercial fashion photography quality.

Photographed using a Canon EOS R5 with ultra sharp professional fashion photography detail, realistic skin texture, high dynamic range, commercial apparel fitting reference photography quality.

The woman stands in a neutral symmetrical standing pose with straight posture, feet naturally positioned, shoulders relaxed, and arms slightly separated from the torso for clear body visibility.

The image is organized as a clean professional multi-panel fashion reference contact sheet with the following views:

Panel 1: front-facing full body view, entire body visible from head to toe.

Panel 2: front-facing portrait close-up view with highly detailed facial features.

Panel 3: left side profile full body view, entire body visible from head to toe.

Panel 4: left side profile portrait close-up view with detailed facial structure.

Panel 5: back-facing full body view, entire body visible from head to toe.

Panel 6: front 3/4 angle full body view for garment fitting reference.

Ultra realistic ecommerce photography, clean composition, centered framing, professional studio production quality, realistic proportions, fashion fit reference photography, apparel fitting reference model.

Avoid dramatic shadows, editorial fashion lighting, exaggerated curves, stylized anatomy, glamour photography, sexualized posing, cinematic color grading, cropped limbs, distorted anatomy, fisheye distortion, blurry details, inconsistent identity, asymmetrical facial features, or unrealistic body proportions.
```

---

## Recommended variables

These are the ones that are actually worth having.

### Identity

- `{AGE_RANGE}`
- `{ETHNICITY}`
- `{BODY_TYPE}`
- `{HEIGHT_RANGE}`

### Face

- `{FACE_SHAPE}`

### Hair

- `{HAIR_DESCRIPTION}`

### Skin

- `{SKIN_TONE}`

---

## Recommended values

### `AGE_RANGE`

Examples:

- early 20s
- late 20s
- early 30s
- mid 40s

### `ETHNICITY`

Examples:

- latina
- east asian
- nordic
- black african
- middle eastern
- mixed ethnicity

### `BODY_TYPE`

Examples:

- slim
- athletic
- curvy
- midsize
- petite
- tall slim

### `HEIGHT_RANGE`

Examples:

- 160cm
- 170cm
- 178cm

### `FACE_SHAPE`

Examples:

- oval
- heart-shaped
- round
- square

### `HAIR_DESCRIPTION`

Examples:

- dark brown slick back ponytail
- black straight shoulder-length hair tied back
- blonde clean bun hairstyle
- curly dark hair tied into a low ponytail

### `SKIN_TONE`

Examples:

- fair skin
- olive skin
- warm tan skin
- deep dark skin

---

## Complete final example

This would be a real example ready to use.

---

```
A highly detailed ultra-realistic ecommerce fashion reference contact sheet featuring the same woman consistently across all panels.

The subject is a woman in her late 20s of latina ethnicity with naturally proportioned midsize body proportions, approximately 170cm tall proportions, warm olive skin tone, oval face shape, and dark brown straight hair tied into a clean low ponytail. She has natural realistic facial features, symmetrical eyes, realistic hands and feet, accurate anatomy, and a neutral fashion catalog expression with relaxed lips and soft eyes.

The same exact woman must appear consistently in every panel with identical facial structure, body proportions, hairstyle, skin tone, and identity.

She is wearing a seamless matte neutral beige skin-tight bodysuit with no visible logos, no patterns, no texture, and no accessories. No jewelry, no tattoos, no piercings, no heavy makeup, no nail polish.

Professional luxury ecommerce studio photography, shot in a seamless pure white infinity backdrop studio environment with soft diffused high-key lighting, evenly lit skin tones, soft natural shadows, and commercial fashion photography quality.

Photographed using a Canon EOS R5 with ultra sharp professional fashion photography detail, realistic skin texture, high dynamic range, 85mm lens portrait compression, commercial apparel fitting reference photography quality.

The woman stands in a neutral symmetrical standing pose with straight posture, feet naturally positioned, shoulders relaxed, and arms slightly separated from the torso for clear body visibility.

The image is organized as a clean professional multi-panel fashion reference contact sheet with the following views:

Panel 1: front-facing full body view, entire body visible from head to toe.

Panel 2: front-facing portrait close-up view with highly detailed facial features.

Panel 3: left side profile full body view, entire body visible from head to toe.

Panel 4: left side profile portrait close-up view with detailed facial structure.

Panel 5: back-facing full body view, entire body visible from head to toe.

Panel 6: front 3/4 angle full body view for garment fitting reference.

Ultra realistic ecommerce photography, clean composition, centered framing, professional studio production quality, realistic proportions, fashion fit reference photography, apparel fitting reference model.

Avoid dramatic shadows, editorial fashion lighting, exaggerated curves, stylized anatomy, glamour photography, sexualized posing, cinematic color grading, cropped limbs, distorted anatomy, fisheye distortion, blurry details, inconsistent identity, asymmetrical facial features, or unrealistic body proportions.
```

---

## Recommended next steps

1. Refine this prompt based on the first real results.
2. Create the:
   - garment prompt
   - pose prompt
   - environment prompt
3. Design a modular combinable system.
4. Create presets for:
   - ecommerce
   - Instagram
   - vintage editorial
   - candid streetwear
   - luxury fashion
   - Pinterest style

The system becomes very powerful once these pieces are in place.
