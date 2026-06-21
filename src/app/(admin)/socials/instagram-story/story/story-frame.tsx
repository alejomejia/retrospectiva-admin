import type { ReactNode } from "react";

import {
  STORY_COLORS,
  STORY_DIM_BLUR,
  STORY_DIM_BLUR_OVERSCAN,
  STORY_DIM_FLAT,
  STORY_GRADIENT_BOTTOM,
  STORY_GRADIENT_TOP,
  STORY_HEIGHT,
  STORY_WIDTH,
} from "../story.const";

/**
 * The constant chrome shared by all templates: background photo, the
 * legibility dim, the top-left logo, and the bottom content column. Pass
 * the variant-specific content as `children` — they stack with a 32px
 * gap, left-aligned, anchored 150px from the bottom.
 *
 * `dim` chooses the photo treatment: `"split"` (default) is the two
 * gradients used by the "new" template; `"flat"` blurs the photo and lays
 * a uniform ink veil over it — what the "sold" template wants behind a
 * centred seal. `overlay` is optional absolutely-positioned art drawn over
 * the photo but under the copy (e.g. `Story.Seal`).
 *
 * Inline styles only — satori reads no Tailwind / CSS vars; every
 * multi-child box sets `display: flex`. Layout numbers are the Figma
 * frame's exact Dev Mode values; colours/fonts come from `story.const`.
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
              height: 700,
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
              height: 1200,
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
        style={{ position: "absolute", top: 150, left: 72, width: 231, height: 240 }}
      />

      {/* Content column */}
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 150,
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
