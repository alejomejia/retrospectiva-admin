/**
 * Reserved empty slot where the old terracotta CTA button used to sit.
 * The Figma frames now leave this 936×133 space transparent on purpose —
 * an Instagram CTA *sticker* is dropped here by hand after export — so it
 * renders nothing visible, just holds the layout gap (the 32px column gaps
 * on either side preserve the design's spacing).
 */
export function StoryCta() {
  return <div style={{ display: "flex", width: "100%", height: 133 }} />;
}
