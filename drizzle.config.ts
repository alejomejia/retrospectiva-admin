import { defineConfig } from "drizzle-kit";

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
