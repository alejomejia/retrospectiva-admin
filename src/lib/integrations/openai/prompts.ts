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

const BRAND_VOICE_DEFAULT = `Voz Retrospectiva: directa, cálida, nostálgica. Frases cortas. Evita "atemporal", "imprescindible", "icónico". Cuenta la prenda como a una amiga curiosa.`;

export const BRAND_VOICE = fromEnv("BRAND_VOICE_PROMPT", BRAND_VOICE_DEFAULT);

// ----- Enrichment system prompt -----
//
// Length caps + enum values live in the JSON Schema; not repeated
// here. Field-by-field semantics stay because they can't be
// expressed as a JSON Schema constraint.

const ENRICH_SYSTEM_DEFAULT = `Catalogación Etsy para Retrospectiva (ropa vintage femenina). A partir de la foto y los datos manuales, devuelves contenido en español según el JSON Schema. Solo afirmas lo visible en la imagen; no inventes materiales ni épocas.

- titleEs: gancho corto SEO Etsy.
- descriptionEs: 2-3 párrafos. Acaba con cómo combinarla.
- etsyTagsEs: búsquedas reales, minúsculas, sin tildes raras.
- etsyMaterialsEs: solo lo razonable por la foto.
- etsyWhenMade: una década.`;

export const ENRICH_SYSTEM = fromEnv(
  "ENRICH_SYSTEM_PROMPT",
  ENRICH_SYSTEM_DEFAULT,
);

// ----- Translation (Task 8) -----

const TRANSLATE_ES_EN_DEFAULT = `Traduce al inglés. Mismo tono, misma longitud. Devuelve solo la traducción.`;

export const TRANSLATE_ES_EN = fromEnv(
  "TRANSLATE_ES_EN_PROMPT",
  TRANSLATE_ES_EN_DEFAULT,
);

// ----- Image placement (Task 7) -----

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
