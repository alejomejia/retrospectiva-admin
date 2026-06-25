import { STORY_COLORS, STORY_FONTS } from "../story.const";

/**
 * Playfair title on the left; on the right an optional price, with an
 * optional struck-through pre-discount "old" price stacked above it
 * (smaller, white at 30%). The old price renders only when a sale is
 * active and the studio's "show discount" toggle is on.
 */
export function StoryTitlePrice({
  title,
  priceLabel,
  originalPriceLabel,
}: {
  title: string;
  priceLabel: string | null;
  originalPriceLabel: string | null;
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
      {priceLabel || originalPriceLabel ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            alignItems: "flex-end",
          }}
        >
          {originalPriceLabel ? (
            <div
              style={{
                display: "flex",
                fontFamily: STORY_FONTS.serif,
                fontWeight: 500,
                fontSize: 48,
                lineHeight: "52px",
                color: STORY_COLORS.oldPrice,
                textDecoration: "line-through",
              }}
            >
              {originalPriceLabel}
            </div>
          ) : null}
          {priceLabel ? (
            <div
              style={{
                display: "flex",
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
      ) : null}
    </div>
  );
}
