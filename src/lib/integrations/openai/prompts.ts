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
 * `docs/project-conventions.md` §1.
 */

function fromEnv(key: string, fallback: string): string {
  const v = process.env[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

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

const ENRICH_SYSTEM_DEFAULT = `Etsy catalog enrichment for Retrospectiva (women's second-hand vintage clothing store). Based on the product photos and manual data, generate Spanish content that follows the provided JSON Schema. Only describe what is realistically visible in the images and provided data. Never invent brands, materials, garment condition, fabric composition, sizing details, or production eras that are not clearly supported.

The writing should feel warm, natural, relaxed, and human — like a curated vintage shop, not a mass-market retailer. Focus on helping the product feel desirable, wearable, and easy to imagine in everyday outfits.

Optimize all generated content for Etsy SEO using natural high-intent search phrases commonly used by shoppers. Prioritize discoverability while keeping the writing authentic and non-spammy. Use Etsy-friendly keywords naturally throughout titles, descriptions, and tags.

Guidelines:

* titleEn: short, searchable Etsy title with strong keywords first. Prioritize garment type, style, color, fit, aesthetic, or decade-inspired terms when visible. First letter uppercase.
* descriptionEn: 2-3 short paragraphs. Make the piece feel special, wearable, and easy to style. Mention visible textures, fit, silhouette, colors, mood, and styling ideas. End with a natural suggestion on how to wear or pair the garment. Use occasional emojis only when they feel natural and add warmth or personality (for example: ✨ 🤎 👖 ☁️ 🌿). Keep emoji usage subtle, minimal, and tasteful — never excessive, spammy, or childish. Avoid using emojis in every sentence or repeating the same emoji multiple times.
* etsyTagsEn: realistic Etsy search terms, lowercase, concise, highly searchable, varied, and non-repetitive.
* etsyMaterialsEn: only include materials that are visually reasonable or confirmed manually.
* etsyWhenMade: choose only a realistic estimated decade if visually supported; otherwise use “unknown”.

Avoid keyword stuffing, exaggerated marketing language, fake scarcity, or overly polished luxury fashion tone. Do not use words like “iconic,” “timeless,” “must-have,” “luxury,” or “exclusive.”

The final content should feel curated, trustworthy, personal, and optimized for real Etsy shoppers looking for unique vintage clothing.`;

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
// Verbatim from `docs/model-generation/phase-1-base-model.md` §3.
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

Each panel is separated by a clean solid pure-white gutter at least 40 pixels to a maximum of 60 pixeles wide on all sides, including the outer trim and inner dividers.

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
