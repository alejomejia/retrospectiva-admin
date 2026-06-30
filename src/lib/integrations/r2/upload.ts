import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { R2_BUCKET, r2 } from "./client";

/**
 * Long-lived, immutable cache directive set on every uploaded object.
 *
 * Why safe to set this aggressively:
 * - Our keys are UUID-based and never overwritten — when the user
 *   "deletes" a photo we delete the object, we never PUT to the same
 *   key with new bytes.
 * - `immutable` tells the browser to skip even conditional revalidation
 *   for the life of the cache. Repeat visitors load images from local
 *   cache with zero network round-trips.
 * - `max-age=31536000` (1 year) lets Cloudflare's edge AND end-user
 *   browsers cache for a year. The public custom domain bound to the
 *   bucket means Cloudflare's CDN auto-fronts every read.
 *
 * Net effect: a hot product's images get pulled from R2 once per
 * Cloudflare edge region, then served from cache for ~everyone else
 * — drops billable Class B read operations by ~99%, and zero egress
 * cost on top (R2 has free egress).
 */
const CACHE_CONTROL_ONE_YEAR_IMMUTABLE =
  "public, max-age=31536000, immutable";

export type UploadToR2Input = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /**
   * Optional `Cache-Control` override. Defaults to a 1-year immutable
   * directive (the right call for our UUID-keyed, never-overwritten
   * objects). Override only if you know the bytes at this key will
   * change without the key changing.
   */
  cacheControl?: string;
  /** Optional override for tests. Defaults to the shared singleton. */
  client?: S3Client;
  /** Optional override for tests. Defaults to the configured bucket. */
  bucket?: string;
};

/**
 * Uploads a single object to R2 at the given key. Returns the key on
 * success (lets the caller chain into a DB insert without re-passing
 * it). Errors bubble up — the action layer decides whether to surface
 * to the user or retry via the queue.
 *
 * @example
 *   const key = await uploadToR2({
 *     key: "products/2026/05/15/abc/original/123.jpg",
 *     body: buf,
 *     contentType: "image/jpeg",
 *   });
 */
export async function uploadToR2({
  key,
  body,
  contentType,
  cacheControl = CACHE_CONTROL_ONE_YEAR_IMMUTABLE,
  client = r2,
  bucket = R2_BUCKET,
}: UploadToR2Input): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
      // NOTE: bucket is public via a custom domain (R2_PUBLIC_BASE_URL),
      // so we don't need to set ACL here — R2 ignores ACLs anyway.
    }),
  );
  return key;
}

export type UploadFileToR2Input = {
  key: string;
  /** Absolute path to the local file to stream up. */
  filePath: string;
  contentType: string;
  /** See {@link UploadToR2Input.cacheControl}. */
  cacheControl?: string;
  client?: S3Client;
  bucket?: string;
};

/**
 * Streams a local file to R2, never loading the whole file into memory.
 * This is the upload half of the video transcode pipeline — the worker
 * streams ffmpeg's MP4 output straight from disk to R2, so a large
 * transcode result doesn't add a full-file Buffer copy on top of ffmpeg's
 * own footprint. Use {@link uploadToR2} for small, already-in-memory
 * payloads (posters, images).
 *
 * `Content-Length` is read from the file up front: a single PUT needs the
 * length, and providing it lets the SDK stream the body straight through
 * rather than buffering it to discover the size.
 */
export async function uploadFileToR2({
  key,
  filePath,
  contentType,
  cacheControl = CACHE_CONTROL_ONE_YEAR_IMMUTABLE,
  client = r2,
  bucket = R2_BUCKET,
}: UploadFileToR2Input): Promise<string> {
  const { size } = await stat(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  return key;
}
