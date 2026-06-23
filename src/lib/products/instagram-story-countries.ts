/**
 * The country mapping for the "sold" story's destination line. Each entry
 * pairs an ISO 3166-1 alpha-2 code with its English display name and emoji
 * flag. Kept free of React / satori / DB so both the studio (client) and the
 * render route (server) can import it — same split as
 * `instagram-story-fields.ts`.
 *
 * Names are ENGLISH on purpose: the generated story is an English-only asset
 * (see `instagram-story.ts`). The list is sorted alphabetically by name; the
 * studio's country combobox renders it in that order.
 */

/** One selectable destination: its code, English name, and emoji flag. */
export type StoryCountry = {
  /** ISO 3166-1 alpha-2 code — the value persisted in the field. */
  code: string;
  /** English country name, shown in the combobox and the footer line. */
  name: string;
  /** Emoji flag, appended after the name in the footer line. */
  flag: string;
};

/** Alphabetical (by name) list of selectable destinations. */
export const STORY_COUNTRIES: readonly StoryCountry[] = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
];

/** Lookup map by code, built once from the list. */
const BY_CODE = new Map(STORY_COUNTRIES.map((c) => [c.code, c]));

/**
 * Resolves a stored country code to its entry, or `undefined` when the code
 * is empty/unknown (the "no destination" case).
 *
 * @param code - ISO alpha-2 code from the field value
 */
export function findStoryCountry(code: string): StoryCountry | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

/**
 * Composes the "sold" footer line: the base tagline, plus a destination
 * suffix when a country is selected. The footer renders uppercase, so the
 * casing here is cosmetic. Returns the bare tagline when no country is set.
 *
 * @param tagline - the base footer tagline (e.g. "One of a kind")
 * @param code - the selected country code (empty for none)
 */
export function composeSoldTagline(tagline: string, code: string): string {
  const country = findStoryCountry(code);
  if (!country) return tagline;
  return `${tagline} - Sent to ${country.name} ${country.flag}`;
}
