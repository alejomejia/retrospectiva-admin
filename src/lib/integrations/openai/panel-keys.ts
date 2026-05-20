/**
 * Panel-key constants for the Model Studio's 3×2 contact-sheet grid.
 * Kept in a deps-free file (no sharp, no openai, no DB) so client
 * components can import `PANEL_ORDER` without pulling Node-only
 * libs into the browser bundle.
 *
 * The actual cropping logic lives in `./grid-crop.ts` (server-only).
 */

export type PanelKey =
  | "front_full"
  | "front_portrait"
  | "front_editorial"
  | "side_portrait"
  | "back_full"
  | "threequarter_full";

/** Reading order: top row left-to-right, then bottom row left-to-right. */
export const PANEL_ORDER: readonly PanelKey[] = [
  "front_full",
  "front_portrait",
  "front_editorial",
  "side_portrait",
  "back_full",
  "threequarter_full",
] as const;
