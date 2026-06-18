import { m } from "@/lib/i18n/messages.es";
import {
  storyEyebrow,
  storyPriceLabel,
} from "@/lib/products/instagram-story";

import {
  StoryCta,
  StoryEyebrow,
  StoryFooter,
  StoryFrame,
  StoryPill,
  StoryTitlePrice,
} from "../story-frame";
import type { StoryRenderContext } from "./types";

/** Static pill copy for the "new arrival" story (rendered uppercase). */
const NEW_BADGE = "New today";

/**
 * "New today" template — a fresh listing: era/size eyebrow, title, price,
 * and a Shop-on-Etsy CTA. Mirrors the Figma `instagram-post-new` frame.
 */
export function renderNewStory({
  product,
  photoUrl,
  logoUrl,
  shopMarkupPercent,
}: StoryRenderContext) {
  // Published products carry the English title (translated at publish);
  // fall back to the Spanish title only defensively.
  const title = product.titleEn?.trim() || product.titleEs?.trim() || "";

  return (
    <StoryFrame photoUrl={photoUrl} logoUrl={logoUrl}>
      <StoryPill>{NEW_BADGE}</StoryPill>
      <StoryEyebrow>{storyEyebrow(product)}</StoryEyebrow>
      <StoryTitlePrice
        title={title}
        priceLabel={storyPriceLabel(product, shopMarkupPercent)}
      />
      <StoryCta>{m.products.instagramStory.ctaEtsy}</StoryCta>
      <StoryFooter
        handle={m.products.instagramStory.footerHandle}
        tagline={m.products.instagramStory.footerTagline}
      />
    </StoryFrame>
  );
}
