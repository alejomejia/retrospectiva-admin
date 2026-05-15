import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle DB singleton. Uses `postgres-js` under the hood with a small
 * connection pool — fine for a two-person admin panel and survives
 * Next.js dev-mode module reloads via `globalThis` caching.
 *
 * NOTE: this file is one of the sanctioned exceptions to the "read
 * env via `config`" rule. The BullMQ worker entrypoint (`queue/
 * worker.ts`) runs under raw `tsx` outside Next.js, and `config`
 * transitively imports `server-only` which throws there. By reading
 * `process.env.DATABASE_URL` directly, this module is safe to import
 * from both contexts (Next.js app + worker). Client-bundle
 * protection is preserved by the `postgres` package itself, which
 * is Node-only and would fail to bundle into a client build.
 *
 * Caller is responsible for ensuring DATABASE_URL is loaded —
 * Next.js does it automatically; the worker calls `loadEnvConfig`
 * before importing this module.
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const DATABASE_POOL_MAX = process.env.DATABASE_POOL_MAX
  ? Number(process.env.DATABASE_POOL_MAX)
  : 10;

const globalForDb = globalThis as unknown as {
  __retrospectivaPg?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__retrospectivaPg ??
  postgres(DATABASE_URL, {
    max: DATABASE_POOL_MAX,
    idle_timeout: 30,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__retrospectivaPg = queryClient;
}

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
