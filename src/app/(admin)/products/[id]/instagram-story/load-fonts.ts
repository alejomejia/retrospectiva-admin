import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { STORY_FONTS } from "./story.const";

/** A font descriptor in the shape `ImageResponse` expects. */
type StoryFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal" | "italic";
};

const ROUTE_DIR = join(
  process.cwd(),
  "src/app/(admin)/products/[id]/instagram-story",
);
const FONT_DIR = join(ROUTE_DIR, "fonts");

// Vendored static (latin) instances at the exact weights the Figma frame
// uses — satori needs raw font bytes and renders multi-axis variable
// fonts unreliably. Cached on the module so repeated requests skip the
// disk read.
let fontCache: StoryFont[] | null = null;
let logoCache: string | null = null;
let sealCache: string | null = null;

/**
 * Loads the brand fonts as buffers at the design weights: Playfair
 * Display Medium upright (title + price) and italic (the "sold" accent
 * word), DM Sans Medium (CTA), and DM Mono Regular (pill, eyebrow,
 * footer).
 */
export async function loadStoryFonts(): Promise<StoryFont[]> {
  if (fontCache) return fontCache;

  const [serif, serifItalic, sans, mono] = await Promise.all([
    readFile(join(FONT_DIR, "PlayfairDisplay-Medium.ttf")),
    readFile(join(FONT_DIR, "PlayfairDisplay-MediumItalic.ttf")),
    readFile(join(FONT_DIR, "DMSans-Medium.ttf")),
    readFile(join(FONT_DIR, "DMMono-Regular.ttf")),
  ]);

  fontCache = [
    { name: STORY_FONTS.serif, data: serif, weight: 500, style: "normal" },
    { name: STORY_FONTS.serif, data: serifItalic, weight: 500, style: "italic" },
    { name: STORY_FONTS.sans, data: sans, weight: 500, style: "normal" },
    { name: STORY_FONTS.mono, data: mono, weight: 400, style: "normal" },
  ];
  return fontCache;
}

/**
 * The Retrospectiva circular stamp logo (exported from the same Figma
 * frame, transparent background) as a base64 data URI, so satori embeds
 * it without a network round-trip. SVG keeps the cream linework crisp at
 * any size. Cached on the module.
 */
export async function loadStoryLogo(): Promise<string> {
  if (logoCache) return logoCache;
  const svg = await readFile(join(ROUTE_DIR, "assets", "logo.svg"));
  logoCache = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return logoCache;
}

/**
 * The "SOLD" stamp seal (exported from the Figma `instagram-post-sold`
 * frame, transparent PNG) as a base64 data URI, overlaid on the centre
 * of the "sold" template. Raster (the stamp has photographic grain), so
 * PNG rather than SVG. Cached on the module.
 */
export async function loadStorySeal(): Promise<string> {
  if (sealCache) return sealCache;
  const png = await readFile(join(ROUTE_DIR, "assets", "sold-seal.png"));
  sealCache = `data:image/png;base64,${png.toString("base64")}`;
  return sealCache;
}
