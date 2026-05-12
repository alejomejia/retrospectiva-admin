import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/lib/utils/config";
import * as schema from "./schema";

/**
 * Drizzle DB singleton. Uses `postgres-js` under the hood with a small
 * connection pool — fine for a two-person admin panel and survives
 * Next.js dev-mode module reloads via `globalThis` caching.
 *
 * All env reads route through `config` (server-only, zod-validated), so
 * a missing DATABASE_URL fails at app boot, not on first query.
 */

const globalForDb = globalThis as unknown as {
  __retrospectivaPg?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__retrospectivaPg ??
  postgres(config.databaseUrl, {
    max: config.databasePoolMax,
    idle_timeout: 30,
    prepare: false,
  });

// Cache the postgres client in dev so HMR doesn't open new connections
// on every reload. In production the module is only loaded once.
if (config.env !== "production") {
  globalForDb.__retrospectivaPg = queryClient;
}

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
