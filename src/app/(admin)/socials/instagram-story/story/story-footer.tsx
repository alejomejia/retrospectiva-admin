import { STORY_COLORS, STORY_FONTS } from "../story.const";

/** Muted uppercase tagline, left-aligned (the handle was dropped). */
export function StoryFooter({ tagline }: { tagline: string }) {
  if (!tagline) return null;
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "flex-start",
        fontFamily: STORY_FONTS.mono,
        color: STORY_COLORS.cream,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 24,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: 0.6,
        }}
      >
        {tagline}
      </div>
    </div>
  );
}
