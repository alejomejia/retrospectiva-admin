/**
 * Shared design tokens for every Instagram-story template.
 *
 * satori (next/og) renders from hardcoded inline styles — it can NOT
 * read `theme.css` CSS variables or Tailwind classes — so the brand
 * palette / type scale / gradients live here as literals, shared by all
 * variants via `story-frame.tsx` and the per-template modules.
 *
 * Source of truth: Figma `Retrospectiva WW` → page `socials`. Values
 * pulled from Dev Mode; reconcile here, never in a template's JSX.
 */

/** Canvas size — Instagram story / reels full-bleed portrait. */
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

/** Brand palette (exact hex from the Figma frames). */
export const STORY_COLORS = {
  /** light-200 — pill/title/cta text, footer. */
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
  serif: "Playfair Display", // Medium (500): title + price
  sans: "DM Sans", // Medium (500): CTA
  mono: "DM Mono", // Regular (400): pill, eyebrow, footer
} as const;

/**
 * The two overlay gradients shared by the templates. The top one darkens
 * behind the logo; the bottom one carries the copy. Note the bottom
 * gradient uses a darker ink (26,25,20) than the frame background.
 */
export const STORY_GRADIENT_TOP = `linear-gradient(180deg, rgba(42,42,37,0.6) 0%, rgba(42,42,37,0) 100%)`;
export const STORY_GRADIENT_BOTTOM = `linear-gradient(0deg, rgba(26,25,20,0.94) 0%, rgba(26,25,20,0.94) 42%, rgba(26,25,20,0.55) 72%, rgba(26,25,20,0) 100%)`;

/**
 * Flat full-frame dim used by the "sold" template instead of the split
 * gradients — a uniform 80% ink veil so the centred SOLD seal and the
 * bottom copy both read over the whole photo. (Figma `gradient-top` on
 * the `instagram-post-sold` frame.)
 */
export const STORY_DIM_FLAT = `rgba(26,25,20,0.8)`;
