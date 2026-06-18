import { m } from "@/lib/i18n/messages.es";

import {
  StoryCta,
  StoryFooter,
  StoryFrame,
  StorySeal,
  StoryTitleAccent,
} from "../story-frame";
import type { StoryRenderContext } from "./types";

/** Static italic accent word for the "sold" story (Playfair, mustard). */
const SOLD_WORD = "Gone";

/**
 * "Sold" template — a celebratory just-sold post: the flat-dimmed photo
 * behind a centred SOLD seal, the title with an italic "Gone" accent,
 * and a shop CTA. No pill/eyebrow/price. Mirrors the Figma
 * `instagram-post-sold` frame; layout/spacing inherited from the shared
 * `StoryFrame` (the "new" frame is the source of truth there).
 */
export function renderSoldStory({
  product,
  photoUrl,
  logoUrl,
  sealUrl,
}: StoryRenderContext) {
  // Sold products were published, so they carry the English title;
  // fall back to the Spanish title only defensively.
  const title = product.titleEn?.trim() || product.titleEs?.trim() || "";

  return (
    <StoryFrame
      photoUrl={photoUrl}
      logoUrl={logoUrl}
      dim="flat"
      overlay={<StorySeal sealUrl={sealUrl} />}
    >
      <StoryTitleAccent title={title} accent={SOLD_WORD} />
      <StoryCta>{m.products.instagramStory.ctaShop}</StoryCta>
      <StoryFooter
        handle={m.products.instagramStory.footerHandle}
        tagline={m.products.instagramStory.footerTagline}
      />
    </StoryFrame>
  );
}
