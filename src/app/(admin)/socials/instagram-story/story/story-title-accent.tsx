import { STORY_COLORS, STORY_FONTS } from "../story.const";

/**
 * Playfair title on the left, an italic Playfair accent word on the
 * right (e.g. the "sold" template's "Gone"). Same row geometry as
 * `Story.TitlePrice`; the accent is upright-italic. Renders nothing for
 * the accent when empty.
 */
export function StoryTitleAccent({
  title,
  accent,
}: {
  title: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          paddingRight: 32,
          fontFamily: STORY_FONTS.serif,
          fontWeight: 500,
          fontSize: 92,
          lineHeight: "90.16px",
          color: STORY_COLORS.cream,
        }}
      >
        {title}
      </div>
      {accent ? (
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            fontFamily: STORY_FONTS.serif,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 96,
            lineHeight: "100.3px",
            color: STORY_COLORS.mustardPrice,
          }}
        >
          {accent}
        </div>
      ) : null}
    </div>
  );
}
