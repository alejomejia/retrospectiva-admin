import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { STORY_FONTS } from "./story-template.const";

/** A font descriptor in the shape `ImageResponse` expects. */
type StoryFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
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

/**
 * Loads the three brand fonts as buffers at the design weights:
 * Playfair Display Medium (title + price), DM Sans Medium (CTA), and
 * DM Mono Regular (pill, eyebrow, footer).
 */
export async function loadStoryFonts(): Promise<StoryFont[]> {
  if (fontCache) return fontCache;

  const [serif, sans, mono] = await Promise.all([
    readFile(join(FONT_DIR, "PlayfairDisplay-Medium.ttf")),
    readFile(join(FONT_DIR, "DMSans-Medium.ttf")),
    readFile(join(FONT_DIR, "DMMono-Regular.ttf")),
  ]);

  fontCache = [
    { name: STORY_FONTS.serif, data: serif, weight: 500, style: "normal" },
    { name: STORY_FONTS.sans, data: sans, weight: 500, style: "normal" },
    { name: STORY_FONTS.mono, data: mono, weight: 400, style: "normal" },
  ];
  return fontCache;
}

/**
 * The Retrospectiva circular stamp logo (exported from the same Figma
 * frame) as a base64 data URI, so satori embeds it without a network
 * round-trip. Cached on the module.
 */
export async function loadStoryLogo(): Promise<string> {
  if (logoCache) return logoCache;
  const png = await readFile(join(ROUTE_DIR, "assets", "logo.png"));
  logoCache = `data:image/png;base64,${png.toString("base64")}`;
  return logoCache;
}
