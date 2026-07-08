/**
 * Etsy's fixed `primary_color` / `secondary_color` vocabulary for
 * listing payloads. Values are sent as lowercase strings in the
 * `createDraftListing` form body.
 *
 * Source: Etsy Open API v3 — `Listing` schema, `primary_color`.
 * Kept as a typed enum so the AI enrichment + listing-mapper share
 * one canonical list and the operator can't free-text a value Etsy
 * will reject.
 */

export const ETSY_COLORS = [
  "beige",
  "black",
  "blue",
  "bronze",
  "brown",
  "clear",
  "copper",
  "gold",
  "gray",
  "green",
  "orange",
  "pink",
  "purple",
  "rainbow",
  "red",
  "rose",
  "silver",
  "white",
  "yellow",
] as const;

export type EtsyColor = (typeof ETSY_COLORS)[number];

const ETSY_COLOR_SET = new Set<string>(ETSY_COLORS);

/** Type-guard for a free-form column value. */
export function isEtsyColor(value: unknown): value is EtsyColor {
  return typeof value === "string" && ETSY_COLOR_SET.has(value);
}

/**
 * English display labels for the picker UI. Keys must stay aligned
 * with the {@link ETSY_COLORS} enum.
 */
export const ETSY_COLOR_LABELS_EN: Record<EtsyColor, string> = {
  beige: "Beige",
  black: "Black",
  blue: "Blue",
  bronze: "Bronze",
  brown: "Brown",
  clear: "Clear",
  copper: "Copper",
  gold: "Gold",
  gray: "Gray",
  green: "Green",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  rainbow: "Rainbow",
  red: "Red",
  rose: "Rose",
  silver: "Silver",
  white: "White",
  yellow: "Yellow",
};
