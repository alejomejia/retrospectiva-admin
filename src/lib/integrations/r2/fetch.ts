import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

import { R2_BUCKET, r2 } from "./client";

/**
 * Pulls an object's bytes from R2 into memory. Used by the Etsy
 * publish worker to stage images + video before uploading them to
 * Etsy's listing endpoints. We round-trip through R2 (rather than
 * passing public URLs to Etsy) because Etsy's image/video endpoints
 * require multipart uploads — they accept bytes, not URLs.
 *
 * No streaming: the byte budget is bounded (≤10 images at ~1 MB each
 * plus one ≤100 MB video) and buffering in memory keeps the worker
 * straightforward. If video size ever becomes a concern, swap this
 * for a stream → blob pipeline.
 */
export type FetchFromR2Input = {
  key: string;
  client?: S3Client;
  bucket?: string;
};

export type FetchFromR2Result = {
  bytes: Uint8Array;
  contentType: string | null;
  contentLength: number | null;
};

export async function fetchBytesFromR2({
  key,
  client = r2,
  bucket = R2_BUCKET,
}: FetchFromR2Input): Promise<FetchFromR2Result> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) {
    throw new Error(`R2 object missing body for key="${key}"`);
  }
  const bytes = await res.Body.transformToByteArray();
  return {
    bytes,
    contentType: res.ContentType ?? null,
    contentLength: res.ContentLength ?? null,
  };
}

export type DownloadToFileInput = {
  key: string;
  /** Absolute path to write to. Caller owns creating/cleaning the dir. */
  destPath: string;
  client?: S3Client;
  bucket?: string;
};

/**
 * Streams an R2 object straight to a local file, never holding the whole
 * payload in memory. This is the download half of the video transcode
 * pipeline: a 100 MB+ raw clip lands on disk for ffmpeg without a Buffer
 * copy, so the worker's peak memory stays bounded to ffmpeg's working set
 * regardless of clip size (the failure mode this whole pipeline exists to
 * kill). Use {@link fetchBytesFromR2} for small, bounded payloads.
 *
 * @returns The number of bytes written (the object's content length).
 */
export async function downloadR2ObjectToFile({
  key,
  destPath,
  client = r2,
  bucket = R2_BUCKET,
}: DownloadToFileInput): Promise<number> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) {
    throw new Error(`R2 object missing body for key="${key}"`);
  }
  // In Node the SDK returns the body as a Readable; pipe it to disk so
  // the bytes never accumulate in memory.
  await pipeline(res.Body as Readable, createWriteStream(destPath));
  return res.ContentLength ?? 0;
}
