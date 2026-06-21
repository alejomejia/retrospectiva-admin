import { STORY_COLORS, STORY_FONTS } from "../story.const";

/** Mono, mustard, tracked eyebrow line. Renders nothing when empty. */
export function StoryEyebrow({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <div
      style={{
        display: "flex",
        fontFamily: STORY_FONTS.mono,
        fontSize: 27,
        letterSpacing: 4.32,
        textTransform: "uppercase",
        color: STORY_COLORS.mustardEyebrow,
      }}
    >
      {children}
    </div>
  );
}
