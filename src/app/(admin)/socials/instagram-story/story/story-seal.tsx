/**
 * The centred SOLD stamp seal, an `overlay` passed to `Story.Frame`.
 * 726×726, positioned by its Figma `instagram-post-sold` top-left
 * (x 177 / y 511 — nudged down from centre in the latest design).
 */
export function StorySeal({ sealUrl }: { sealUrl: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      src={sealUrl}
      width={726}
      height={726}
      style={{ position: "absolute", left: 177, top: 511, width: 726, height: 726 }}
    />
  );
}
