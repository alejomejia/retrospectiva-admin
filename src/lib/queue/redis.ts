import { Redis } from "ioredis";

/**
 * Shared ioredis connection for BullMQ.
 *
 * BullMQ's docs are explicit: workers using blocking commands
 * (BLPOP, BRPOPLPUSH, etc.) require `maxRetriesPerRequest: null`
 * and `enableReadyCheck: false`. Without these, the worker
 * silently drops in-flight jobs on transient connection blips.
 *
 * Cached on `globalThis` so HMR doesn't open a new connection on
 * every reload — identical to the pattern in `db/client.ts` and
 * `integrations/r2/client.ts`.
 *
 * NOTE: this file is one of the sanctioned exceptions to the
 * "always read env via `config`" rule. The worker entrypoint runs
 * under raw `tsx` (not Next.js), and `config` transitively imports
 * `server-only` which throws when there's no react-server bundler
 * condition. Same pattern drizzle.config.ts uses — caller is
 * responsible for ensuring REDIS_URL is loaded (Next.js does it
 * automatically; the worker calls `loadEnvConfig` before importing
 * this module).
 *
 * Reference: https://docs.bullmq.io/guide/connections
 */

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is not set");
}

const globalForRedis = globalThis as unknown as {
  __retrospectivaRedis?: Redis;
};

export const redis =
  globalForRedis.__retrospectivaRedis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__retrospectivaRedis = redis;
}
