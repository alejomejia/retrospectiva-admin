/**
 * R2 key generation for product media. Kept as a pure helper so unit
 * tests can lock down the shape without spinning up an S3 mock.
 *
 * Key layout:
 *   {dev|prod}/products/{YYYY}/{MM}/{DD}/{productId}/{role}/{uuid}.{ext}
 *
 * - Every key is prefixed with the environment (`dev/` or `prod/`, via
 *   `ENV_PREFIX`) so dev and prod media stay isolated in the same R2
 *   bucket.
 *
 * - The date prefix is the product's CREATION date (not the upload
 *   date), formatted in Europe/Madrid so it matches what the admin
 *   sees in the UI. All media for a product lives under one date
 *   prefix forever, even if photos are added weeks after creation.
 *   This makes the R2 console browseable by month / year and keeps
 *   per-product deletes a single prefix sweep.
 * - `productId` is a UUID, URL-safe and unique.
 * - `role` (original | ai_model | thumbnail) matches the
 *   `product_images.role` column — lets a future
 *   `deleteR2Prefix(products/{date}/{id}/{role}/)` sweep one role
 *   only (e.g. nuke AI shots before regenerating).
 * - The trailing UUID lets two uploads of the same filename coexist
 *   without overwriting each other.
 *
 * Existing keys from before this layout (`products/{id}/…`) keep
 * resolving because `product_images.r2Key` stores the full key —
 * historical data isn't migrated.
 */

import type { ProductImage } from "@/lib/db/schema";
import { isDev } from "@/lib/utils/config";

const ALLOWED_EXTENSIONS = ["webp", "jpg", "jpeg", "png", "avif"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm"] as const;
export type AllowedVideoExtension = (typeof ALLOWED_VIDEO_EXTENSIONS)[number];

export type ImageRole = ProductImage["role"];

const ENV_PREFIX = isDev ? "dev" : "prod";

/**
 * Renders a Date as `YYYY/MM/DD` in Europe/Madrid. Two-digit month +
 * day for sortability. Throws on a malformed Date — keys are part of
 * persistent storage, silent fallbacks here would be very expensive.
 */
export function formatDatePrefix(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`formatDatePrefix: invalid date (${date.toISOString?.()})`);
  }
  return `${year}/${month}/${day}`;
}

export type GenerateImageKeyInput = {
  productId: string;
  /** Product's creation timestamp; provides the date partition. */
  createdAt: Date;
  role: ImageRole;
  /** A v4 UUID. Caller is responsible for generating it (see `randomUUID()`). */
  uuid: string;
  /** Extension WITHOUT the leading dot. Validated against ALLOWED_EXTENSIONS. */
  extension: string;
};

export function generateImageKey({
  productId,
  createdAt,
  role,
  uuid,
  extension,
}: GenerateImageKeyInput): string {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
    throw new Error(
      `Unsupported image extension "${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    );
  }
  return `${ENV_PREFIX}/products/${formatDatePrefix(createdAt)}/${productId}/${role}/${uuid}.${ext}`;
}

/**
 * Builds the public URL for a stored key, using R2_PUBLIC_BASE_URL.
 * Doesn't fetch — pure string concat with one slash-collapse so callers
 * never produce `//` in the middle.
 */
export function publicUrlFor(key: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/** Prefix that scopes ALL keys for a product (used by manual hard-delete). */
export function productPrefix(productId: string, createdAt: Date): string {
  return `${ENV_PREFIX}/products/${formatDatePrefix(createdAt)}/${productId}/`;
}

/**
 * Video files live under their own bucket prefix so a future
 * `deleteR2Prefix("products/{date}/{id}/video/")` would sweep just
 * the videos (e.g. if we ever support replacing a product's video).
 */
export type GenerateVideoKeyInput = {
  productId: string;
  createdAt: Date;
  uuid: string;
  extension: string;
};

export function generateVideoKey({
  productId,
  createdAt,
  uuid,
  extension,
}: GenerateVideoKeyInput): string {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext as AllowedVideoExtension)) {
    throw new Error(
      `Unsupported video extension "${extension}". Allowed: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`,
    );
  }
  return `${ENV_PREFIX}/products/${formatDatePrefix(createdAt)}/${productId}/video/${uuid}.${ext}`;
}

/**
 * Poster keys share the same `{productId}/{uuid}` stem as their video so
 * the pair can be correlated in R2 without a DB roundtrip. Always WebP
 * (we always extract via Canvas).
 */
export function generateVideoPosterKey({
  productId,
  createdAt,
  uuid,
}: {
  productId: string;
  createdAt: Date;
  uuid: string;
}): string {
  return `${ENV_PREFIX}/products/${formatDatePrefix(createdAt)}/${productId}/video_poster/${uuid}.webp`;
}
