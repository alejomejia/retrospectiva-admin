// @vitest-environment node
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { detectGridCrops, PANEL_ORDER } from "./grid-crop";

/**
 * Build a synthetic 3×2 contact sheet for tests:
 *
 *   - Pure-white background (so the gutter scanner has clear bands).
 *   - Six dark rectangles representing the panel content, offset by
 *     a `gutter`-px white margin on all sides + between cells.
 *
 * Returns the PNG buffer + the panel rectangles for assertions.
 */
async function buildSheet(opts: {
  panelW: number;
  panelH: number;
  gutter: number;
  outerTrim?: number;
}): Promise<Buffer> {
  const { panelW, panelH, gutter, outerTrim = 0 } = opts;
  const totalW = outerTrim * 2 + panelW * 3 + gutter * 2;
  const totalH = outerTrim * 2 + panelH * 2 + gutter;

  // Six dark rectangles (one per panel) to composite on the white
  // background. Color doesn't matter as long as it's far below the
  // 245 brightness threshold.
  const composites: sharp.OverlayOptions[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const left = outerTrim + col * (panelW + gutter);
      const top = outerTrim + row * (panelH + gutter);
      composites.push({
        input: {
          create: {
            width: panelW,
            height: panelH,
            channels: 3,
            background: { r: 30, g: 30, b: 30 },
          },
        },
        left,
        top,
      });
    }
  }

  return sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

describe("detectGridCrops", () => {
  it("finds all 6 panels in a clean 3×2 grid (no outer trim)", async () => {
    const sheet = await buildSheet({ panelW: 300, panelH: 400, gutter: 20 });
    const result = await detectGridCrops(sheet);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.panels)).toEqual([...PANEL_ORDER]);
  });

  it("returns panel boxes in row-major order matching the documented layout", async () => {
    const sheet = await buildSheet({ panelW: 300, panelH: 400, gutter: 20 });
    const result = await detectGridCrops(sheet);
    expect(result).not.toBeNull();
    const p = result!.panels;

    // Top row: front_full, front_portrait, front_editorial (left → right).
    expect(p.front_full.left).toBeLessThan(p.front_portrait.left);
    expect(p.front_portrait.left).toBeLessThan(p.front_editorial.left);
    expect(p.front_full.top).toBe(p.front_portrait.top);
    expect(p.front_portrait.top).toBe(p.front_editorial.top);

    // Bottom row: side_portrait, back_full, threequarter_full.
    expect(p.side_portrait.left).toBeLessThan(p.back_full.left);
    expect(p.back_full.left).toBeLessThan(p.threequarter_full.left);
    expect(p.side_portrait.top).toBe(p.back_full.top);
    expect(p.back_full.top).toBe(p.threequarter_full.top);

    // Bottom row sits below the top row.
    expect(p.side_portrait.top).toBeGreaterThan(p.front_full.top);
  });

  it("produces six equal-width panels via the equal-thirds split", async () => {
    // 3×300 panels + 2×20 inner gutters = 940 wide → W/3 = 313.
    // Each panel's width is floor(W/3) for the first two columns; the
    // third absorbs any remainder. Heights derive from the detected
    // middle horizontal gutter, not equal-halves, so they match the
    // synthetic panel height plus the half-gutter on each side.
    const sheet = await buildSheet({ panelW: 300, panelH: 400, gutter: 20 });
    const result = await detectGridCrops(sheet);
    expect(result).not.toBeNull();
    const p = result!.panels;

    // All three columns are equal-width (within 1px for the
    // remainder absorbed by the third column).
    expect(p.front_full.width).toBe(p.front_portrait.width);
    expect(p.front_portrait.width).toBeLessThanOrEqual(p.front_editorial.width);
    expect(Math.abs(p.front_editorial.width - p.front_full.width)).toBeLessThanOrEqual(2);

    // Top and bottom row panels share the same width per column.
    expect(p.front_full.width).toBe(p.side_portrait.width);
    expect(p.front_portrait.width).toBe(p.back_full.width);
    expect(p.front_editorial.width).toBe(p.threequarter_full.width);
  });

  it("strips top/bottom outer trim from the row bounds", async () => {
    // 30px outer trim on all sides. Top/bottom trim is detected as
    // gutter bands touching the image edge and excluded from panel
    // bounds. Left/right trim is folded into the leftmost/rightmost
    // panel (equal-thirds doesn't subtract side trim) — harmless
    // for Phase 2, see the module docblock.
    const sheet = await buildSheet({
      panelW: 250,
      panelH: 300,
      gutter: 20,
      outerTrim: 30,
    });
    const result = await detectGridCrops(sheet);
    expect(result).not.toBeNull();
    expect(result!.panels.front_full.top).toBeGreaterThanOrEqual(30);
    expect(result!.panels.side_portrait.top).toBeLessThanOrEqual(
      // bottom-row top edge lives below the inner horizontal gutter
      300 + 30 + 20,
    );
  });

  it("succeeds on a grid where figures are narrow within panels (the real-world failure mode)", async () => {
    // Mimics the actual gpt-image-2 output: figures occupy only the
    // center ~30% of each panel's width; the left/right halves of
    // each panel are white backdrop. The old column-projection
    // algorithm failed here because in-panel whitespace mimicked
    // real gutters.
    const totalW = 940;
    const totalH = 820;
    const composites: sharp.OverlayOptions[] = [];
    const panelW = 300;
    const panelH = 400;
    const gutter = 20;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const panelLeft = col * (panelW + gutter);
        const panelTop = row * (panelH + gutter);
        // Narrow figure centered in each panel.
        composites.push({
          input: {
            create: {
              width: 80, // narrow — figure occupies ~27% of panel width
              height: panelH,
              channels: 3,
              background: { r: 30, g: 30, b: 30 },
            },
          },
          left: panelLeft + Math.floor((panelW - 80) / 2),
          top: panelTop,
        });
      }
    }
    const sheet = await sharp({
      create: {
        width: totalW,
        height: totalH,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    const result = await detectGridCrops(sheet);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.panels)).toEqual([...PANEL_ORDER]);
  });

  it("returns null when the image has no detectable grid", async () => {
    // A solid grey image — no gutters anywhere.
    const flat = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .png()
      .toBuffer();
    const result = await detectGridCrops(flat);
    expect(result).toBeNull();
  });

  it("returns null when the grid has the wrong number of dividers (e.g. 2×2 instead of 3×2)", async () => {
    // Synthetic 2×2 grid (one inner horizontal divider, one inner
    // vertical) — our detector requires 1 horizontal + 2 vertical.
    const composites: sharp.OverlayOptions[] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        composites.push({
          input: {
            create: {
              width: 300,
              height: 300,
              channels: 3,
              background: { r: 30, g: 30, b: 30 },
            },
          },
          left: c * 320,
          top: r * 320,
        });
      }
    }
    const sheet = await sharp({
      create: {
        width: 620,
        height: 620,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
    const result = await detectGridCrops(sheet);
    expect(result).toBeNull();
  });

  it("returns null on a degenerate tiny image", async () => {
    const tiny = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();
    expect(await detectGridCrops(tiny)).toBeNull();
  });
});
