import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 is S3-compatible. Same SDK, different endpoint + signing
 * region. Single client reused across handlers; cached on `globalThis`
 * so HMR doesn't open a new connection on every reload.
 *
 * Cloudflare API docs:
 *   https://developers.cloudflare.com/r2/api/s3/api/
 *
 * NOTE: this file intentionally does NOT `import "server-only"` and
 * reads `process.env` directly rather than going through
 * `@/lib/utils/config`. Reason: the BullMQ worker
 * (`src/lib/queue/worker.ts`) runs under raw `tsx` where the
 * `server-only` chain in `config.ts` throws on import. Task 8
 * (Model Studio) uploads contact sheets + cropped panels from the
 * worker via `model-generate.ts` → `r2/upload.ts` → this file.
 * Same sanctioned exception as `db/client.ts`, `openai/client.ts`,
 * and `queue/redis.ts`; tracked in
 * `docs/project-conventions.md` §1. Client-bundle protection is
 * preserved because `@aws-sdk/client-s3` is a Node-only SDK that
 * fails to bundle into a client build anyway.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`R2 env not set: ${name}`);
  }
  return v;
}

const r2AccountId = requireEnv("R2_ACCOUNT_ID");
const r2AccessKeyId = requireEnv("R2_ACCESS_KEY_ID");
const r2SecretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

const globalForR2 = globalThis as unknown as {
  __retrospectivaR2?: S3Client;
};

export const r2 =
  globalForR2.__retrospectivaR2 ??
  new S3Client({
    region: "auto", // R2 ignores region but the SDK requires one.
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForR2.__retrospectivaR2 = r2;
}

export const R2_BUCKET = requireEnv("R2_BUCKET");
export const R2_PUBLIC_BASE_URL = requireEnv("R2_PUBLIC_BASE_URL");
