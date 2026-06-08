/**
 * Etsy per-entry character caps. Etsy rejects tags over 20 chars and
 * materials over 45 chars in *every* locale (ES and EN alike), so these
 * apply to the Spanish source values and their English translations.
 */
export const ETSY_TAG_MAX_LEN = 20;
export const ETSY_MATERIAL_MAX_LEN = 45;

/**
 * Clamp one tag/keyword phrase to `maxLen`, dropping whole trailing
 * words first so the result stays a meaningful phrase rather than a
 * mid-word stub (e.g. "vestido flores años 90" → "vestido flores" at a
 * 20-char cap). A single leading word longer than `maxLen` is hard cut.
 * Returns "" if nothing survives.
 */
export function clampPhraseToMaxLen(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;

  let acc = "";
  for (const word of trimmed.split(/\s+/)) {
    const next = acc ? `${acc} ${word}` : word;
    if (next.length > maxLen) break;
    acc = next;
  }
  return acc || trimmed.slice(0, maxLen).trim();
}

/**
 * Clamp every entry of a tag/material list to `maxLen` via
 * {@link clampPhraseToMaxLen}, dropping entries that clamp to empty.
 *
 * Use this on any model-produced tag/material list before it is stored
 * or sent to Etsy: OpenAI structured outputs ignore JSON-Schema
 * `maxLength`, so the model can emit over-long entries even when the
 * schema and prompt forbid them.
 */
export function clampPhrasesToMaxLen(list: string[], maxLen: number): string[] {
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const clamped = clampPhraseToMaxLen(raw, maxLen);
    if (clamped) out.push(clamped);
  }
  return out;
}
