/**
 * Design tokens for the 1080×1920 Instagram-story export.
 *
 * satori (next/og) renders from hardcoded inline styles — it can NOT
 * read `theme.css` CSS variables or Tailwind classes — so the values
 * are mirrored here as literals.
 *
 * Source of truth: Figma `Retrospectiva WW` → page `socials` → frame
 * `instagram-post-new` (node 16:783). Values pulled from Dev Mode; keep
 * them grouped here so a future design change is a single-file update.
 */

/** Canvas size — Instagram story / reels full-bleed portrait. */
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

/** Brand palette (exact hex from the Figma frame). */
export const STORY_COLORS = {
  /** light-200 — pill/eyebrow-less text, title, cta text, footer. */
  cream: "#f7f3e7",
  /** terracotta-300 — pill + CTA background. */
  terracotta: "#a6461b",
  /** mustard-100 — eyebrow line. */
  mustardEyebrow: "#e8c989",
  /** mustard-200 — price. */
  mustardPrice: "#d4a44f",
  /** Frame background behind the photo. */
  ink: "#2a2a25",
} as const;

/** Font family names — must match the `name` passed to ImageResponse. */
export const STORY_FONTS = {
  serif: "Playfair Display",
  sans: "DM Sans",
  mono: "DM Mono",
} as const;

/** Static literal for the freshness pill (rendered uppercase). */
export const STORY_BADGE_TEXT = "New today";

/**
 * The two overlay gradients from the frame. Top one darkens behind the
 * logo; bottom one carries the copy. Note the bottom gradient uses a
 * darker ink (26,25,20) than the frame background.
 */
export const STORY_GRADIENT_TOP = `linear-gradient(180deg, rgba(42,42,37,0.6) 0%, rgba(42,42,37,0) 100%)`;
export const STORY_GRADIENT_BOTTOM = `linear-gradient(0deg, rgba(26,25,20,0.94) 0%, rgba(26,25,20,0.94) 42%, rgba(26,25,20,0.55) 72%, rgba(26,25,20,0) 100%)`;
