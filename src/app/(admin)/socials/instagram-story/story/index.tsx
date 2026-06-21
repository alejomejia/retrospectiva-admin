/**
 * Compound satori building blocks for every Instagram-story template.
 * `Story.Frame` is the constant chrome (full-bleed photo + dim + top-left
 * logo + bottom content column); each template fills that column with the
 * slot primitives below. A new template is just a fresh composition of
 * these — no new layout maths.
 *
 * Inline styles only — satori reads no Tailwind / CSS vars. Colours/fonts
 * and layout numbers come from `../story.const` (the Figma source of truth).
 */
import { StoryCta } from "./story-cta";
import { StoryEyebrow } from "./story-eyebrow";
import { StoryFooter } from "./story-footer";
import { StoryFrame } from "./story-frame";
import { StoryPill } from "./story-pill";
import { StorySeal } from "./story-seal";
import { StoryTitleAccent } from "./story-title-accent";
import { StoryTitlePrice } from "./story-title-price";

export const Story = Object.assign(StoryFrame, {
  Frame: StoryFrame,
  Pill: StoryPill,
  Eyebrow: StoryEyebrow,
  TitlePrice: StoryTitlePrice,
  TitleAccent: StoryTitleAccent,
  Cta: StoryCta,
  Footer: StoryFooter,
  Seal: StorySeal,
});
