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
 * `docs/overview/project-conventions.md` §1. Client-bundle protection is
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

/**
 * R2's S3 API endpoint for this account. Exported so the presigner
 * (`presign.ts`) can build/sign upload URLs against the same host the
 * client talks to.
 */
export const R2_ENDPOINT = `https://${r2AccountId}.r2.cloudflarestorage.com`;

/**
 * Raw R2 credentials. Exported ONLY for `presign.ts`, which needs them to
 * construct a standalone SigV4 signer (the `@aws-sdk/s3-request-presigner`
 * package is unbuildable in this registry, so we sign with
 * `@smithy/signature-v4` directly). Server-only module — these never reach
 * a client bundle. NOTE: treat as secret; do not log.
 */
export const r2Credentials = {
  accessKeyId: r2AccessKeyId,
  secretAccessKey: r2SecretAccessKey,
};

const globalForR2 = globalThis as unknown as {
  __retrospectivaR2?: S3Client;
};

export const r2 =
  globalForR2.__retrospectivaR2 ??
  new S3Client({
    region: "auto", // R2 ignores region but the SDK requires one.
    endpoint: R2_ENDPOINT,
    credentials: r2Credentials,
    // NOTE: the SDK's default socket has NO timeout — a half-open
    // connection to R2 (network blip on the VPS / Cloudflare hiccup)
    // leaves `client.send()` awaiting forever. That stalls the video
    // server action indefinitely: it never resolves OR rejects, so the
    // uploader's "Subiendo…" spinner hangs with zero error client- or
    // server-side. Bounding both timeouts converts a stall into a
    // thrown error the action layer can surface and the SDK can retry.
    // Both are idle/establish timeouts (reset on socket activity), so a
    // legitimately long 100 MB upload with bytes flowing is unaffected
    // — only a genuinely stuck socket trips them.
    requestHandler: {
      connectionTimeout: 6_000, // ms to establish the TCP/TLS socket
      requestTimeout: 30_000, // ms of socket inactivity before abort
    },
    maxAttempts: 3, // retry the timeout/transient failure a couple times
  });

if (process.env.NODE_ENV !== "production") {
  globalForR2.__retrospectivaR2 = r2;
}

export const R2_BUCKET = requireEnv("R2_BUCKET");
export const R2_PUBLIC_BASE_URL = requireEnv("R2_PUBLIC_BASE_URL");
