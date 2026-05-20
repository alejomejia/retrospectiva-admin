import sharp from "sharp";

import { PANEL_ORDER, type PanelKey } from "./panel-keys";

export { PANEL_ORDER, type PanelKey } from "./panel-keys";

/**
 * Detect a 3×2 grid of panels in a contact-sheet image and return
 * bounding boxes for each panel in the documented order:
 *
 *   ┌──────────────┬───────────────┬───────────────┐
 *   │ front_full   │ front_portrait│front_editorial│  ← top row
 *   ├──────────────┼───────────────┼───────────────┤
 *   │ side_portrait│   back_full   │threequarter_  │  ← bottom row
 *   │              │               │     full      │
 *   └──────────────┴───────────────┴───────────────┘
 *
 * **Algorithm — hybrid structural + detection**:
 *
 * 1. **Horizontal middle gutter**: detect by projection. The two
 *    portrait panels (cols 2 + 4) span their column's full height
 *    with face content, anchoring the row scan, so we reliably get
 *    exactly one inner all-white row band.
 *
 * 2. **Vertical splits**: trust the prompt's "equal panel
 *    dimensions" contract and divide the image width into thirds.
 *    Column-gutter detection by projection FAILS in this domain
 *    because figures inside panels are narrow standing poses —
 *    so half of every panel's column-space is in-panel whitespace
 *    that's indistinguishable from real gutters. Equal-thirds plus
 *    a "split lines fall in white space" sanity check is the
 *    robust approach.
 *
 * 3. **Top/bottom outer trim**: shaved off when present, otherwise
 *    panels start at y=0 / end at y=H. Small extra margin in a
 *    crop is harmless for Phase 2; missing figure content would
 *    not be.
 *
 * Returns `null` if the image doesn't look like a 3×2 grid (no
 * detectable middle horizontal divider, divider in a weird
 * vertical position, or the equal-thirds split lines don't fall
 * in whitespace). Caller decides what to do with `null` — typically
 * save the sheet only and flip `crops_available=false`.
 */

export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type GridDetection = {
  panels: Record<PanelKey, Box>;
};

/** Brightness above which a pixel is considered "white gutter". */
const WHITE_THRESHOLD = 245;
/** Fraction of a row that must be ≥WHITE_THRESHOLD for it to count
 *  as a gutter line. The pure-white backdrop + 40px gutter spec
 *  makes 0.985 safe without false positives from stray hair/shadow
 *  pixels intruding into the gutter band. */
const GUTTER_PIXEL_FRACTION = 0.985;
/** Minimum gutter thickness in pixels. Single-row matches can fire
 *  on stray near-white scanlines inside a panel. Several consecutive
 *  rows is the gutter signature. */
const MIN_GUTTER_THICKNESS = 4;
/** Acceptable position window for the horizontal middle gutter,
 *  expressed as fractions of image height. Outside this range we
 *  bail — likely not a 3×2 grid. */
const MIDDLE_GUTTER_BAND = { min: 0.35, max: 0.65 } as const;
/** When validating an equal-thirds vertical split, the column at
 *  the split boundary must be at least this fraction white. Looser
 *  than `GUTTER_PIXEL_FRACTION` because the column may sit at the
 *  edge of a gutter rather than the center. */
const SPLIT_VALIDATION_FRACTION = 0.8;

/**
 * Detect the 3×2 grid in a contact sheet. Accepts the raw image
 * bytes that came out of `openai.images.generate(...)`.
 */
export async function detectGridCrops(
  imageBytes: Buffer,
): Promise<GridDetection | null> {
  const image = sharp(imageBytes);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;

  const { data, info } = await image
    .clone()
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;
  if (W < 60 || H < 40) return null;

  // ----- horizontal: find the single inner middle gutter -----
  const hBands = findGutterBands(data, W, H, "row");
  const innerH = hBands.filter((b) => b.start > 0 && b.end < H - 1);
  if (innerH.length !== 1) return null;
  const middle = innerH[0]!;
  const middleCenter = (middle.start + middle.end) / 2;
  if (
    middleCenter < H * MIDDLE_GUTTER_BAND.min ||
    middleCenter > H * MIDDLE_GUTTER_BAND.max
  ) {
    return null;
  }

  // Top/bottom outer trim — if present, exclude from panel bounds.
  const topTrim = hBands.find((b) => b.start === 0);
  const bottomTrim = hBands.find((b) => b.end === H);
  const topY = topTrim?.end ?? 0;
  const bottomY = bottomTrim?.start ?? H;

  // ----- vertical: equal thirds + sanity check -----
  // The prompt asks for "equal panel dimensions" and the model is
  // very consistent about it. Detecting column gutters by projection
  // would over-match because figures don't fill panel widths.
  const colWidth = Math.floor(W / 3);
  const splitX1 = colWidth;
  const splitX2 = 2 * colWidth;

  // Each split line must land in whitespace (a real gutter), not
  // through the middle of a figure. Catches the case where the
  // model produced a 2×N grid or other non-3-column layout.
  if (
    !columnIsMostlyWhite(data, W, H, splitX1) ||
    !columnIsMostlyWhite(data, W, H, splitX2)
  ) {
    return null;
  }

  // ----- assemble panel boxes in PANEL_ORDER (row-major) -----
  const colSplits: Array<{ start: number; end: number }> = [
    { start: 0, end: splitX1 },
    { start: splitX1, end: splitX2 },
    { start: splitX2, end: W },
  ];
  const rowSplits: Array<{ start: number; end: number }> = [
    { start: topY, end: middle.start },
    { start: middle.end, end: bottomY },
  ];

  const panels = {} as Record<PanelKey, Box>;
  let i = 0;
  for (const row of rowSplits) {
    for (const col of colSplits) {
      const key = PANEL_ORDER[i++]!;
      panels[key] = {
        left: col.start,
        top: row.start,
        width: col.end - col.start,
        height: row.end - row.start,
      };
    }
  }
  return { panels };
}

/**
 * Crop the contact sheet into 6 PNG buffers keyed by panel name.
 * Convenience around `detectGridCrops` + `sharp.extract` so the
 * worker only deals with one call.
 */
export async function cropPanelsFromSheet(
  imageBytes: Buffer,
): Promise<Record<PanelKey, Buffer> | null> {
  const detection = await detectGridCrops(imageBytes);
  if (!detection) return null;

  const buffers = {} as Record<PanelKey, Buffer>;
  for (const key of PANEL_ORDER) {
    const box = detection.panels[key];
    buffers[key] = await sharp(imageBytes)
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .png()
      .toBuffer();
  }
  return buffers;
}

// ---------- internals ----------

type GutterBand = { start: number; end: number; thickness: number };

/**
 * Scan a grayscale buffer row-by-row (or column-by-column) and
 * return contiguous bands where ≥`GUTTER_PIXEL_FRACTION` of the
 * scanline's pixels are ≥`WHITE_THRESHOLD`. Bands thinner than
 * `MIN_GUTTER_THICKNESS` are dropped.
 *
 * Only used for the horizontal direction now — see the module
 * docblock for why column-direction detection was retired.
 */
function findGutterBands(
  data: Buffer,
  width: number,
  height: number,
  axis: "row" | "col",
): GutterBand[] {
  const lineCount = axis === "row" ? height : width;
  const lineLength = axis === "row" ? width : height;
  const whiteFractions = new Float32Array(lineCount);
  for (let line = 0; line < lineCount; line++) {
    let white = 0;
    for (let pos = 0; pos < lineLength; pos++) {
      const idx = axis === "row" ? line * width + pos : pos * width + line;
      if (data[idx]! >= WHITE_THRESHOLD) white++;
    }
    whiteFractions[line] = white / lineLength;
  }

  const bands: GutterBand[] = [];
  let current: { start: number } | null = null;
  for (let i = 0; i < lineCount; i++) {
    const isGutter = whiteFractions[i]! >= GUTTER_PIXEL_FRACTION;
    if (isGutter && current === null) {
      current = { start: i };
    } else if (!isGutter && current !== null) {
      const thickness = i - current.start;
      if (thickness >= MIN_GUTTER_THICKNESS) {
        bands.push({ start: current.start, end: i, thickness });
      }
      current = null;
    }
  }
  if (current !== null) {
    const thickness = lineCount - current.start;
    if (thickness >= MIN_GUTTER_THICKNESS) {
      bands.push({
        start: current.start,
        end: lineCount,
        thickness,
      });
    }
  }
  return bands;
}

/**
 * `true` if the column at `x` is at least `SPLIT_VALIDATION_FRACTION`
 * white. Used to sanity-check that an equal-thirds split line falls
 * through a real gutter rather than slicing a figure in half.
 */
function columnIsMostlyWhite(
  data: Buffer,
  width: number,
  height: number,
  x: number,
): boolean {
  let white = 0;
  for (let y = 0; y < height; y++) {
    if (data[y * width + x]! >= WHITE_THRESHOLD) white++;
  }
  return white / height >= SPLIT_VALIDATION_FRACTION;
}
