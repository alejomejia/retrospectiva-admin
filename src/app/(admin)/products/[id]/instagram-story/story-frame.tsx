import type { ReactNode } from "react";

import {
  STORY_COLORS,
  STORY_DIM_BLUR,
  STORY_DIM_BLUR_OVERSCAN,
  STORY_DIM_FLAT,
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
 * The constant chrome shared by all templates: background photo, the
 * legibility dim, the top-left logo, and the bottom content column. Pass
 * the variant-specific content as `children` — they stack with a 32px
 * gap, left-aligned, anchored 72px from the bottom.
 *
 * `dim` chooses the photo treatment: `"split"` (default) is the two
 * gradients used by the "new" template; `"flat"` blurs the photo and lays
 * a uniform ink veil over it — what the "sold" template wants behind a
 * centred seal. `overlay` is optional
 * absolutely-positioned art drawn over the photo but under the copy
 * (e.g. `StorySeal`).
 */
export function StoryFrame({
  photoUrl,
  logoUrl,
  children,
  dim = "split",
  overlay,
}: {
  photoUrl: string;
  logoUrl: string;
  children: ReactNode;
  dim?: "split" | "flat";
  overlay?: ReactNode;
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
      {dim === "flat" ? (
        /* Blurred photo. satori ignores `backdrop-filter` and `filter` on
           an <img>, but DOES apply `filter` to a parent's whole subtree —
           so the blur lives on this clipping wrapper. The photo bleeds
           `OVERSCAN`px past every edge so the blur samples real pixels
           instead of feathering to transparent. */
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: STORY_WIDTH,
            height: STORY_HEIGHT,
            overflow: "hidden",
            filter: `blur(${STORY_DIM_BLUR}px)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src={photoUrl}
            width={STORY_WIDTH + STORY_DIM_BLUR_OVERSCAN * 2}
            height={STORY_HEIGHT + STORY_DIM_BLUR_OVERSCAN * 2}
            style={{
              position: "absolute",
              top: -STORY_DIM_BLUR_OVERSCAN,
              left: -STORY_DIM_BLUR_OVERSCAN,
              width: STORY_WIDTH + STORY_DIM_BLUR_OVERSCAN * 2,
              height: STORY_HEIGHT + STORY_DIM_BLUR_OVERSCAN * 2,
              objectFit: "cover",
            }}
          />
        </div>
      ) : (
        /* Full-bleed sharp product photo */
        // eslint-disable-next-line @next/next/no-img-element
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
      )}

      {dim === "flat" ? (
        /* Uniform ink veil over the whole photo */
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: STORY_WIDTH,
            height: STORY_HEIGHT,
            backgroundColor: STORY_DIM_FLAT,
          }}
        />
      ) : (
        <>
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
        </>
      )}

      {/* Optional centred art (e.g. the sold seal) over the photo */}
      {overlay}

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

/**
 * Playfair title on the left, an italic Playfair accent word on the
 * right (e.g. the "sold" template's "Gone"). Same row geometry as
 * `StoryTitlePrice`; the accent is upright-italic and always shown.
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

/**
 * The centred SOLD stamp seal, an `overlay` passed to `StoryFrame`.
 * 726×726, positioned by its Figma top-left (the frame's
 * `left calc(50%+10px) / top calc(50%-125px)` centre).
 */
export function StorySeal({ sealUrl }: { sealUrl: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      src={sealUrl}
      width={726}
      height={726}
      style={{ position: "absolute", left: 187, top: 472, width: 726, height: 726 }}
    />
  );
}
