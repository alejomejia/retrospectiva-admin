import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Standalone migration runner, invoked at container boot before the app
 * starts serving (see `docker-compose.yml` app command).
 *
 * Why not `drizzle-kit migrate`? That CLI applies the SQL but does not
 * reliably terminate with the `postgres` driver — the open connection keeps
 * the event loop alive, so the process hangs after migrating. Gating
 * `next start` on it (`migrate && start`) then deadlocks the container.
 *
 * This script uses drizzle-orm's runtime migrator, explicitly closes the
 * connection, and exits with a definitive status code. It only needs
 * DATABASE_URL — not the full app env — so it runs outside `@/lib/utils/config`.
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

async function main() {
  // NOTE: dedicated single-use connection — closed in `finally` so the
  // process can exit instead of hanging on an open pool.
  const sql = postgres(DATABASE_URL!, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: "./src/lib/db/migrations",
    });
    console.log("[migrate] migrations up to date");
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[migrate] failed:", error);
    process.exit(1);
  });
