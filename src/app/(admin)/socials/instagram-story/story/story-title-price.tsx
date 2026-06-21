import { STORY_COLORS, STORY_FONTS } from "../story.const";

/** Playfair title on the left, optional Playfair price on the right. */
export function StoryTitlePrice({
  title,
  priceLabel,
}: {
  title: string;
  priceLabel: string | null;
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
      {priceLabel ? (
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            fontFamily: STORY_FONTS.serif,
            fontWeight: 500,
            fontSize: 96,
            lineHeight: "100.3px",
            color: STORY_COLORS.mustardPrice,
          }}
        >
          {priceLabel}
        </div>
      ) : null}
    </div>
  );
}
