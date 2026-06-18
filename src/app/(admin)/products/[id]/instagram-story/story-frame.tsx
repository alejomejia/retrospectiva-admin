import type { ReactNode } from "react";

import {
  STORY_COLORS,
  STORY_FONTS,
  STORY_GRADIENT_BOTTOM,
  STORY_GRADIENT_TOP,
  STORY_HEIGHT,
  STORY_WIDTH,
} from "./story.const";

/**
 * Shared satori-compatible building blocks for every story template.
 * `StoryFrame` is the constant chrome (full-bleed photo + the two
 * gradients + top-left logo + the bottom 72px-gutter content column);
 * each template fills that column with the primitives below (or its own
 * JSX). Inline styles only — satori reads no Tailwind / CSS vars; every
 * multi-child box sets `display: flex`. Layout numbers are the Figma
 * frame's exact Dev Mode values; colours/fonts come from `story.const`.
 */

/**
 * The constant chrome shared by all templates: background photo, the two
 * legibility gradients, the top-left logo, and the bottom content column.
 * Pass the variant-specific content as `children` — they stack with a
 * 32px gap, left-aligned, anchored 72px from the bottom.
 */
export function StoryFrame({
  photoUrl,
  logoUrl,
  children,
}: {
  photoUrl: string;
  logoUrl: string;
  children: ReactNode;
}) {
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
      {/* Full-bleed product photo */}
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

      {/* Content column */}
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
        {children}
      </div>
    </div>
  );
}

/** Rounded terracotta label, e.g. the "New today" / "Sold" pill. */
export function StoryPill({ children }: { children: ReactNode }) {
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

/** Full-width terracotta CTA pill with the trailing up-right arrow. */
export function StoryCta({ children }: { children: ReactNode }) {
  return (
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
        {children}
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
  );
}

/** Handle on the left, muted uppercase tagline on the right. */
export function StoryFooter({
  handle,
  tagline,
}: {
  handle: string;
  tagline: string;
}) {
  return (
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
        {handle}
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
        {tagline}
      </div>
    </div>
  );
}
