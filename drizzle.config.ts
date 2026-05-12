import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone Node CLI, so it doesn't pick up `.env.local`
// the way Next does. Loading via `@next/env` here gives us the same file
// precedence Next uses (`.env.local` → `.env.development` → `.env`), so
// `pnpm db:migrate` and the running app always see the same DATABASE_URL.
loadEnvConfig(process.cwd());

// NOTE: this file is a drizzle-kit CLI config, not app runtime. It reads
// process.env directly (instead of @/lib/utils/config) so commands like
// `pnpm db:generate` and `pnpm db:migrate` only need DATABASE_URL set,
// not the full app environment.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
