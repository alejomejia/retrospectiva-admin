import { Hash } from "@smithy/hash-node";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";

import { R2_BUCKET, R2_ENDPOINT, r2Credentials } from "./client";

/**
 * Default lifetime of a presigned upload URL. Long enough for a large
 * clip on a slow connection, short enough that a leaked URL is useless
 * minutes later. The signed URL only grants a PUT to the one exact key.
 */
const DEFAULT_EXPIRES_SECONDS = 15 * 60;

/**
 * For a presigned S3/R2 PUT the payload is unknown at signing time, so the
 * canonical request hashes the literal `UNSIGNED-PAYLOAD` instead of the
 * body. It's carried as a header purely so the signer picks it up as the
 * payload hash, then excluded from `SignedHeaders` (via `unsignableHeaders`)
 * so the browser doesn't have to send it back.
 */
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const SHA256_HEADER = "x-amz-content-sha256";

// Standalone SigV4 signer pointed at R2. We sign here rather than via
// `@aws-sdk/s3-request-presigner` because that package is unbuildable in
// this registry (its transitive `@smithy/core` pin doesn't resolve).
// `uriEscapePath: false` matches the S3 client's signing config — the key
// path is used verbatim in the canonical request, not double-escaped.
const signer = new SignatureV4({
  service: "s3",
  region: "auto",
  credentials: r2Credentials,
  sha256: Hash.bind(null, "sha256"),
  uriEscapePath: false,
});

export type PresignPutUrlInput = {
  key: string;
  /**
   * `Content-Type` the client MUST send on the PUT. It's a signed header,
   * so the upload is rejected if the browser sends a different type — a
   * cheap integrity check on what lands at the key.
   */
  contentType: string;
  /** URL lifetime in seconds. Defaults to {@link DEFAULT_EXPIRES_SECONDS}. */
  expiresInSeconds?: number;
};

/**
 * Mints a presigned R2 PUT URL so the browser can upload bytes DIRECTLY
 * to the bucket, bypassing the app server entirely. This is the whole
 * point of the video pipeline: a 100 MB+ clip never transits — let alone
 * buffers in — the Next.js process, so a large upload can't OOM the app
 * container. The signature scopes the grant to exactly `{ PUT, key,
 * contentType }` and expires; it confers no other bucket access.
 *
 * @example
 *   const url = await presignPutUrl({
 *     key: "prod/products/2026/06/30/abc/video_raw/uuid.mov",
 *     contentType: "video/quicktime",
 *   });
 *   // browser: await fetch(url, { method: "PUT", body: file,
 *   //   headers: { "Content-Type": "video/quicktime" } })
 */
export async function presignPutUrl({
  key,
  contentType,
  expiresInSeconds = DEFAULT_EXPIRES_SECONDS,
}: PresignPutUrlInput): Promise<string> {
  const endpoint = new URL(R2_ENDPOINT);
  // Path-style addressing: /{bucket}/{key}. Our keys are generated from
  // UUIDs + fixed prefixes, so every char is already URL-safe.
  const path = `${endpoint.pathname.replace(/\/$/, "")}/${R2_BUCKET}/${key}`;

  const request = new HttpRequest({
    method: "PUT",
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path,
    headers: {
      host: endpoint.host,
      "content-type": contentType,
      [SHA256_HEADER]: UNSIGNED_PAYLOAD,
    },
  });

  const signed = await signer.presign(request, {
    expiresIn: expiresInSeconds,
    unsignableHeaders: new Set([SHA256_HEADER]),
  });

  // Serialize the signed query. encodeURIComponent matches SigV4's RFC-3986
  // escaping for every value here (hex/dates/identifiers/`/`/`;`), and the
  // server re-canonicalizes from the decoded values regardless.
  const query = Object.entries(signed.query ?? {})
    .flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((vv) => [k, vv] as const)
        : [[k, String(v)] as const],
    )
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return `${endpoint.protocol}//${endpoint.host}${path}?${query}`;
}
