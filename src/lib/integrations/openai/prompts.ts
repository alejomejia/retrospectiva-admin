/**
 * AI prompt templates. Every named export is overridable via an env
 * variable of the same name; the defaults below ship as a starting
 * point and can be iterated on without a code change.
 *
 * Cost discipline: templates are written tight. Structural rules
 * (field types, length caps, enum values) live in the JSON Schema
 * sent alongside the request — repeating them in prose burns tokens
 * for zero quality gain. The schema is authoritative; the prompt
 * only carries semantic guidance the schema can't express (tone,
 * "only state what's visible", etc.).
 *
 * Templates are written in Spanish because every model output is
 * Spanish first; the EN counterparts come from the translation
 * pipeline.
 *
 * NOTE: this file intentionally does NOT `import "server-only"` and
 * reads `process.env` directly. Same reason as `openai/client.ts` —
 * the BullMQ worker (`queue/worker.ts`) runs under raw `tsx` where
 * the `server-only` chain throws. Tracked in
 * `docs/overview/project-conventions.md` §1.
 */

import { fromEnv } from "@/lib/utils/helpers";

// ----- Brand voice -----

const BRAND_VOICE_DEFAULT = `Retrospectiva voice: close, warm, relaxed, and deeply appreciative of clothing with history. Write like a friend who just found a beautiful vintage piece and wants to show it to you. Use natural, easy-to-read sentences with a human, honest, slightly nostalgic tone — never pretentious or overly fashion-focused.

Describe how the garment feels, how it could be worn, or what makes it special. Focus on authentic details, charming imperfections, textures, colors, and personality.

Avoid words like “timeless,” “essential,” “iconic,” “luxury,” or “exclusive,” and avoid overly commercial language. Don’t sound corporate or excessively trendy.

The clothing should feel loved, carefully sourced, and ready for a second life.`;

export const BRAND_VOICE = fromEnv("BRAND_VOICE_PROMPT", BRAND_VOICE_DEFAULT);

// ----- Enrichment system prompt -----
//
// Length caps + enum values live in the JSON Schema; not repeated
// here. Field-by-field semantics stay because they can't be
// expressed as a JSON Schema constraint.

const ENRICH_SYSTEM_DEFAULT = `Etsy catalog enrichment for Retrospectiva (women's second-hand vintage clothing store).

Based ONLY o
1. the uploaded product photos
2. manually provided product data
3. optional seller comments

Generate Spanish content following the provided JSON Schema.

IMPORTANT:

Only describe the actual garment being sold.

Do NOT describe, reference, or infer any non-product objects visible in the image.

NON-PRODUCT ELEMENTS TO IGNORE:

- belts unless explicitly confirmed as included
- jewelry
- shoes
- bags
- hats
- mannequins
- plants
- furniture
- studio decoration
- lighting
- background fabrics
- props
- styling accessories
- layered garments not confirmed as included

Assume all visible accessories are NOT included unless explicitly specified in the input data.

Never invent:

- brands
- fabric composition
- garment condition
- sizing details
- decade/era
- textures
- fit characteristics
- closures/details not clearly visible
- included accessories

MATERIAL & TEXTURE RULES:

Only mention materials or textures when they are visually obvious or manually confirmed.

Allowed examples:

- “tejido tipo punto”
- “acabado satinado”
- “textura ligera”
- “tejido estructurado”

Avoid specific fabric claims unless confirmed:

- cotton
- linen
- wool
- silk
- polyester
- leather
- suede
- denim
- velvet

If uncertain, use neutral wording like:

- “tejido con textura”
- “acabado suave”
- “patrón visible”
- “estructura ligera”

ERA / DECADE RULES:

Only assign a decade if strongly supported visually or manually confirmed.

If the era is uncertain:

- use "unknown" for etsyWhenMade
- avoid mentioning decades in tags or description

If a decade IS assigned:

- all related references MUST stay consistent across:

  - etsyWhenMade
  - title
  - description
  - tags

Example:

If etsyWhenMade = "1980s"

allowed tags:

- "80s dress"
- "vintage 80s"

not allowed:

- "90s style"
- "y2k"

WRITING STYLE:

The writing should feel warm, relaxed, curated, and human — like a thoughtful vintage shop.

Avoid:

- luxury language
- exaggerated marketing
- fake scarcity
- over-selling
- repetitive adjectives
- keyword stuffing

Do not use words like:

- iconic
- timeless
- must-have
- luxury
- exclusive

SEO GUIDELINES:

Optimize naturally for Etsy SEO using real shopper search phrases.

Prioritize:

- garment type
- silhouette
- visible pattern
- color
- aesthetic
- visible fit
- sleeve type
- neckline
- visible style cues

Use keywords naturally and avoid spammy repetition.

FIELD RULES:

titleEn:

- Short Etsy-friendly title
- Strong searchable keywords first
- Only include attributes clearly visible or confirmed
- First letter uppercase
- Avoid keyword stacking

descriptionEn:

- 2-3 short paragraphs
- Focus only on the garment being sold
- Describe visible silhouette, pattern, colors, shape, and styling potential
- Keep descriptions grounded and realistic
- Mention styling suggestions naturally
- Occasional subtle emojis allowed (✨ 🤎 🌿) but minimal

etsyTagsEn:

- Lowercase
- Concise
- Highly searchable
- Non-repetitive
- No contradictory decades/styles
- No invented materials
- No accessories unless included

etsyMaterialsEn:

- ONLY include confirmed or visually obvious materials
- If uncertain, return empty array

etsyWhenMade:

- Use only:
  - "1920s"
  - "1930s"
  - "1940s"
  - "1950s"
  - "1960s"
  - "1970s"
  - "1980s"
  - "1990s"
  - "2000s"
  - "2010s"
  - "2020s"
  - "unknown"

etsyPrimaryColor / etsySecondaryColor:

- Pick from the Etsy color vocabulary ONLY:
  beige, black, blue, bronze, brown, clear, copper, gold, gray,
  green, orange, pink, purple, rainbow, red, rose, silver, white,
  yellow
- etsyPrimaryColor = the single dominant color of the garment.
- etsySecondaryColor = the next most prominent color, or null if
  the garment is monochrome / the secondary color is not visually
  obvious.
- Match the printed pattern as well as the base fabric. For
  multicolor prints with no clear hierarchy use "rainbow".

comments:

If seller comments are provided, incorporate them naturally and carefully.

Do not copy them literally.

Do not prioritize comments over visible evidence.

FINAL SAFETY RULE:

When uncertain, prefer omission over invention.

Being accurate and trustworthy is more important than sounding detailed.`;

export const ENRICH_SYSTEM = fromEnv(
  "ENRICH_SYSTEM_PROMPT",
  ENRICH_SYSTEM_DEFAULT,
);

// ----- Translation (Task 8) -----

const TRANSLATE_ES_EN_DEFAULT = `Translate to English. Same tone, same length. Return only the translation.`;

export const TRANSLATE_ES_EN = fromEnv(
  "TRANSLATE_ES_EN_PROMPT",
  TRANSLATE_ES_EN_DEFAULT,
);

// ----- Base model generation (Task 8 · Model Studio) -----
//
// Verbatim from `docs/ai/model-generation/phase-1-base-model.md` §3.
// The `{VAR}` placeholders are filled at call time by the worker.
// Override the entire template via `BASE_MODEL_GENERATION_PROMPT`
// when iterating on tone without redeploying.

const BASE_MODEL_GENERATION_DEFAULT = `A highly detailed realistic ecommerce fashion reference contact sheet featuring the same woman consistently across all panels.

The subject is a {AGE_RANGE} european woman with naturally proportioned {BODY_TYPE} body proportions, approximately {HEIGHT_RANGE} tall proportions, {SKIN_TONE} skin tone, {FACE_SHAPE} face shape, and {HAIR_COLOR} {HAIR_TYPE} hair styled as a {HAIR_SHAPE}.

She looks like a real everyday person rather than a fashion model — naturally attractive, approachable, believable, and realistic. Subtle natural asymmetry, authentic skin texture, soft facial features, slight imperfections, realistic pores, natural proportions, and relaxed posture.

No exaggerated beauty standards, no glamour model appearance, no runway model proportions, no idealized facial perfection, no hyper-symmetry, and no stylized editorial beauty.

The same woman must appear consistently in every panel with consistent facial structure, body proportions, hairstyle, skin tone, and identity.

She is wearing a seamless matte opaque full-coverage unitard, non-sheer fabric, neutral light beige, with no visible logos, patterns, accessories, jewelry, tattoos, piercings, heavy makeup, or nail polish.

Minimal natural makeup only. Soft natural lips, realistic under-eye texture, realistic skin variation, and natural human facial detail.

Professional ecommerce studio photography in a seamless pure white infinity backdrop studio environment with soft diffused lighting, balanced exposure, soft natural shadows, and clean commercial catalog photography quality.

Shot using realistic commercial apparel photography styling with accurate body proportions, realistic skin rendering, and natural photographic detail.

The woman stands in a neutral relaxed standing pose with natural posture, shoulders relaxed, feet naturally positioned, and arms slightly separated from the torso for clear body visibility.

The image is organized as a structured professional fashion reference contact sheet using a fixed 3-column by 2-row grid layout with equal panel dimensions, symmetrical spacing, and aligned composition.

Each panel is separated by a clean solid pure-white gutter at least 40 pixels to a maximum of 60 pixels wide on all sides, including the outer trim and inner dividers.

The panel order must remain identical and consistent in every generation, arranged from left to right and top to bottom in the following exact order:

Panel 1 (top-left): front-facing full body view, entire body visible from head to toe.

Panel 2 (top-center): front-facing portrait close-up view with natural facial detail.

Panel 3 (top-right): front-facing upper-torso close-up view, cropped and framed from shoulders to abdomen.

Panel 4 (bottom-left): left side profile portrait close-up view with detailed facial structure.

Panel 5 (bottom-center): back-facing full body view, entire body visible from head to toe.

Panel 6 (bottom-right): front 3/4 angle full body view for garment fitting reference.

All panels must maintain consistent framing, centered positioning, equal spacing, identical alignment, and clean white negative space between panels for reliable automated cropping and dataset-style reference extraction.

Realistic ecommerce photography, clean composition, centered framing, believable proportions, natural anatomy, realistic skin texture, authentic human appearance, and commercial apparel fitting reference quality.

Avoid glamour photography, editorial fashion styling, exaggerated curves, stylized anatomy, hyper-perfect faces, unrealistic symmetry, porcelain skin, excessive beauty retouching, dramatic posing, cinematic color grading, sexualized posing, distorted anatomy, artificial body proportions, doll-like appearance, or influencer-style beauty aesthetics.`;

export const BASE_MODEL_GENERATION = fromEnv(
  "BASE_MODEL_GENERATION_PROMPT",
  BASE_MODEL_GENERATION_DEFAULT,
);

// ----- Image placement (Task 11) -----

const IMAGE_PLACEMENT_DEFAULT = `Coloca la prenda en una modelo realista, foto tipo iPhone. Ubicación: {location}. Color y corte fieles al original. Sin retoques excesivos.`;

export const IMAGE_PLACEMENT = fromEnv(
  "IMAGE_PLACEMENT_PROMPT",
  IMAGE_PLACEMENT_DEFAULT,
);

const LOCATION_POOL_DEFAULT = [
  "estudio fotográfico con luz natural",
  "calle adoquinada por la mañana",
  "tienda vintage con suelo de madera",
  "salón con ventana grande",
];

/** Comma-separated env override; falls back to the default array. */
export const LOCATION_POOL: string[] = (() => {
  const raw = process.env.LOCATION_POOL;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return LOCATION_POOL_DEFAULT;
})();

export function pickRandomLocation(): string {
  const i = Math.floor(Math.random() * LOCATION_POOL.length);
  return LOCATION_POOL[i] ?? LOCATION_POOL_DEFAULT[0];
}
