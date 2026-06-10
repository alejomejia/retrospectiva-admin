/** Joiner between the title body and the brand suffix. */
const TITLE_SUFFIX_SEPARATOR = " | ";

/**
 * Fixed brand tagline appended to every listing title, per locale. It
 * is a constant, not AI-generated and not AI-translated — the publish
 * processor appends it deterministically at the payload boundary so it
 * stays out of the enrich prompt and the ES→EN translation queue.
 */
const TITLE_SUFFIX: Record<"es" | "en", string> = {
  es: "Vintage segunda mano",
  en: "Vintage second hand",
};

/**
 * Appends the locale's brand suffix to a listing `title`. An empty
 * title is returned unchanged so callers can apply it unconditionally
 * (the mapper still validates presence/length on the result).
 */
export function appendTitleSuffix(title: string, locale: "es" | "en"): string {
  const trimmed = title.trim();
  if (!trimmed) return trimmed;
  return `${trimmed}${TITLE_SUFFIX_SEPARATOR}${TITLE_SUFFIX[locale]}`;
}
