import { composeSoldTagline } from "@/lib/products/instagram-story-countries";

import { Story } from "../story";
import type { StoryRenderContext } from "./types";

/**
 * "Sold" template — a celebratory just-sold post: the flat-dimmed photo
 * behind a centred SOLD seal, the title with an italic accent word, an
 * empty reserved slot (for an Instagram CTA sticker added by hand), and a
 * tagline footer. No pill/eyebrow/price. Mirrors the Figma
 * `instagram-post-sold` frame; layout/spacing inherited from the shared
 * `Story.Frame`. All copy comes from `fields`.
 */
export function renderSoldStory({
  fields,
  photoUrl,
  logoUrl,
  sealUrl,
  transparent,
}: StoryRenderContext) {
  return (
    <Story.Frame
      photoUrl={photoUrl}
      logoUrl={logoUrl}
      dim="flat"
      overlay={<Story.Seal sealUrl={sealUrl} />}
      transparent={transparent}
    >
      <Story.TitleAccent title={fields.title} accent={fields.accent} />
      <Story.Cta />
      <Story.Footer
        tagline={composeSoldTagline(fields.footerTagline, fields.country ?? "")}
      />
    </Story.Frame>
  );
}
