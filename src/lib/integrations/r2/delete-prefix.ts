import "server-only";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

import { R2_BUCKET, r2 } from "./client";

const MAX_KEYS_PER_LIST = 1000;
const MAX_KEYS_PER_DELETE = 1000; // S3 DeleteObjects limit.

export type DeleteR2PrefixInput = {
  /**
   * MUST end with `/`. The trailing slash isn't decorative — it's the
   * safety net that prevents `products/abc` from also matching
   * `products/abc-other`. We refuse to run without it.
   */
  prefix: string;
  /** Optional override for tests. Defaults to the shared singleton. */
  client?: S3Client;
  /** Optional override for tests. Defaults to the configured bucket. */
  bucket?: string;
};

export type DeleteR2PrefixResult = {
  /** Total keys deleted. 0 if the prefix was already empty. */
  deletedCount: number;
};

/**
 * Lists every object under `prefix` and deletes them in batches.
 *
 * Pagination: R2's S3-compat ListObjectsV2 returns up to 1000 keys per
 * call, with a continuation token. We loop until exhausted. Each batch
 * is deleted via DeleteObjects (also capped at 1000), so a product
 * with 5 images is one list + one delete; a product with 5000 AI shots
 * would be 5 lists + 5 deletes.
 *
 * Safety: the `prefix` MUST end with `/`. A `products/abc` prefix
 * (no slash) would also match `products/abc-extra/…` keys. We throw
 * before talking to R2 if the slash is missing.
 *
 * @example
 *   await deleteR2Prefix({ prefix: "products/abc/" });
 */
export async function deleteR2Prefix({
  prefix,
  client = r2,
  bucket = R2_BUCKET,
}: DeleteR2PrefixInput): Promise<DeleteR2PrefixResult> {
  if (!prefix.endsWith("/")) {
    // NOTE: refusing to proceed is the right call — a bare prefix like
    // `products/abc` could sweep `products/abc-other/…` along with it.
    throw new Error(
      `deleteR2Prefix refuses prefixes that don't end with "/": ${prefix}`,
    );
  }

  let deletedCount = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: MAX_KEYS_PER_LIST,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((c) => c.Key)
      .filter((k): k is string => typeof k === "string");

    // Belt-and-suspenders: every returned key must start with our prefix.
    // R2 should already guarantee this, but a stray result would be a
    // catastrophic bug; better to throw than over-delete.
    for (const key of keys) {
      if (!key.startsWith(prefix)) {
        throw new Error(
          `R2 returned an unexpected key outside the requested prefix: ${key}`,
        );
      }
    }

    // S3 DeleteObjects caps at 1000, ListObjectsV2 caps at 1000 too, so
    // we never need to chunk further within a single page.
    for (let i = 0; i < keys.length; i += MAX_KEYS_PER_DELETE) {
      const chunk = keys.slice(i, i + MAX_KEYS_PER_DELETE);
      if (chunk.length === 0) continue;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      deletedCount += chunk.length;
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return { deletedCount };
}
