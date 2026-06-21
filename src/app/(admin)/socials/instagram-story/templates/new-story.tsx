import { Story } from "../story";
import type { StoryRenderContext } from "./types";

/**
 * "New today" template — a fresh listing: badge pill, era/size eyebrow,
 * title, and price, above an empty reserved slot (for an Instagram CTA
 * sticker added by hand) and a tagline footer. Mirrors the Figma
 * `instagram-post-new` frame. All copy comes from `fields` (defaults
 * computed in `instagram-story-fields.ts`, optionally overridden).
 */
export function renderNewStory({
  fields,
  photoUrl,
  logoUrl,
}: StoryRenderContext) {
  return (
    <Story.Frame photoUrl={photoUrl} logoUrl={logoUrl}>
      <Story.Pill>{fields.badge}</Story.Pill>
      <Story.Eyebrow>{fields.eyebrow || null}</Story.Eyebrow>
      <Story.TitlePrice title={fields.title} priceLabel={fields.price || null} />
      <Story.Cta />
      <Story.Footer tagline={fields.footerTagline} />
    </Story.Frame>
  );
}
