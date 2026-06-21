import type { ReactNode } from "react";

import { STORY_COLORS, STORY_FONTS } from "../story.const";

/**
 * Rounded terracotta label, e.g. the "New today" pill. Renders nothing
 * when empty so a cleared field drops the element.
 */
export function StoryPill({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: STORY_COLORS.terracotta,
        borderRadius: 999,
        padding: "15px 26px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: STORY_FONTS.mono,
          fontSize: 22,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: STORY_COLORS.cream,
        }}
      >
        {children}
      </div>
    </div>
  );
}
