import type { Product } from "@/lib/db/schema";

/**
 * Shape passed from the server page to the client list shell. The
 * `effectiveListPriceCents` is computed server-side so the table
 * never needs to know about the shop markup.
 */
export type ProductListItem = Pick<
  Product,
  | "id"
  | "titleEs"
  | "status"
  | "basePriceCents"
  | "buyPriceCents"
  | "discountPercent"
  | "condition"
  | "size"
  | "currency"
  | "createdAt"
  | "isFeatured"
> & {
  thumbnailUrl: string | null;
  effectiveListPriceCents: number | null;
};

/** Selectable + reorderable columns in the /products table. */
export const COLUMN_KEYS = [
  "thumbnail",
  "title",
  "condition",
  "featured",
  "size",
  "status",
  "basePrice",
  "buyPrice",
  "discount",
  "price",
  "createdAt",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type ColumnPref = { key: ColumnKey; visible: boolean };

/** Default ordering + visibility. */
export const DEFAULT_COLUMN_PREFS: ColumnPref[] = [
  { key: "thumbnail", visible: true },
  { key: "title", visible: true },
  { key: "featured", visible: true },
  { key: "condition", visible: false },
  { key: "size", visible: false },
  { key: "status", visible: true },
  { key: "basePrice", visible: true },
  { key: "buyPrice", visible: true },
  { key: "discount", visible: true },
  { key: "price", visible: true },
  { key: "createdAt", visible: true },
];
