import {
  STORY_BADGE_TEXT,
  STORY_COLORS,
  STORY_FONTS,
  STORY_GRADIENT_BOTTOM,
  STORY_GRADIENT_TOP,
  STORY_HEIGHT,
  STORY_WIDTH,
} from "./story-template.const";

export type StoryTemplateProps = {
  /** Absolute / data-URI source of the chosen product photo. */
  photoUrl: string;
  /** Era · size conversion line, already composed. Omitted when null. */
  eyebrow: string | null;
  /** Product title (English). */
  title: string;
  /** Formatted price, e.g. `€48.99`. Omitted when null (undecided). */
  priceLabel: string | null;
  /** CTA pill text (without the trailing arrow). */
  ctaLabel: string;
  /** Footer handle, e.g. `@retrospectiva.preloved`. */
  footerHandle: string;
  /** Footer tagline, e.g. `One of a kind` (rendered uppercase). */
  footerTagline: string;
  /** Circular brand-logo image (data URI), shown top-left. */
  logoUrl: string;
};

/**
 * The 1080×1920 story layout as satori-compatible JSX, mirroring the
 * Figma frame `instagram-post-new` (node 16:783). Inline styles only
 * (no Tailwind / CSS vars); every multi-child box sets `display: flex`
 * because satori requires it. Colour/font/gradient literals come from
 * `story-template.const.ts`; the layout numbers below are the frame's
 * exact Dev Mode values.
 */
export function StoryTemplate({
  photoUrl,
  eyebrow,
  title,
  priceLabel,
  ctaLabel,
  footerHandle,
  footerTagline,
  logoUrl,
}: StoryTemplateProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        backgroundColor: STORY_COLORS.ink,
      }}
    >
      {/* Full-bleed product photo (frame uses a centred 1920² cover) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={photoUrl}
        width={STORY_WIDTH}
        height={STORY_HEIGHT}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: STORY_WIDTH,
          height: STORY_HEIGHT,
          objectFit: "cover",
        }}
      />

      {/* Top gradient (darkens behind the logo) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          width: STORY_WIDTH,
          height: 360,
          backgroundImage: STORY_GRADIENT_TOP,
        }}
      />
      {/* Bottom gradient (carries the copy) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          display: "flex",
          width: STORY_WIDTH,
          height: 1080,
          backgroundImage: STORY_GRADIENT_BOTTOM,
        }}
      />

      {/* Logo — top-left */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={logoUrl}
        width={231}
        height={240}
        style={{ position: "absolute", top: 60, left: 72, width: 231, height: 240 }}
      />

      {/* Content stack — bottom, 72px gutters */}
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 72,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 32,
        }}
      >
        {/* Freshness pill */}
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
            {STORY_BADGE_TEXT}
          </div>
        </div>

        {/* Eyebrow: era · size conversion */}
        {eyebrow ? (
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
            {eyebrow}
          </div>
        ) : null}

        {/* Title + price */}
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

        {/* CTA pill */}
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: STORY_COLORS.terracotta,
            borderRadius: 999,
            padding: "38px 48px 43px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: STORY_FONTS.sans,
              fontWeight: 500,
              fontSize: 40,
              letterSpacing: 0.4,
              color: STORY_COLORS.cream,
            }}
          >
            {ctaLabel}
            {/* Inline SVG arrow — the ↗ glyph isn't in DM Sans, so satori
                would otherwise fall back to a colour emoji. */}
            <svg
              width={34}
              height={34}
              viewBox="0 0 24 24"
              fill="none"
              stroke={STORY_COLORS.cream}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: STORY_FONTS.mono,
            color: STORY_COLORS.cream,
          }}
        >
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 1.04 }}>
            {footerHandle}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 3,
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            {footerTagline}
          </div>
        </div>
      </div>
    </div>
  );
}
