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
