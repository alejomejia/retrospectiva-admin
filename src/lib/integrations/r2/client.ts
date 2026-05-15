import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { config, isProd } from "@/lib/utils/config";

/**
 * Cloudflare R2 is S3-compatible. Same SDK, different endpoint + signing
 * region. Single client reused across handlers; cached on `globalThis`
 * so HMR doesn't open a new connection on every reload.
 *
 * Cloudflare API docs:
 *   https://developers.cloudflare.com/r2/api/s3/api/
 */

const globalForR2 = globalThis as unknown as {
  __retrospectivaR2?: S3Client;
};

export const r2 =
  globalForR2.__retrospectivaR2 ??
  new S3Client({
    region: "auto", // R2 ignores region but the SDK requires one.
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });

if (!isProd) {
  globalForR2.__retrospectivaR2 = r2;
}

export const R2_BUCKET = config.r2Bucket;
export const R2_PUBLIC_BASE_URL = config.r2PublicBaseUrl;
