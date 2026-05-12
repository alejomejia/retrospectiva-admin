import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest is configured for two flavors of test, both in this single config:
 *   - jsdom: React component tests (anything matching *.tsx)
 *   - node:  pure-lib tests (auth, hmac, listing-mapper, prompts, …)
 *
 * The `environmentMatchGlobs` rule below picks the right env automatically.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    // jsdom covers both component tests and pure-lib tests in Vitest 4.
    // The runtime overhead is small and avoids the per-glob environment
    // selection that was removed from InlineConfig.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Test-only env defaults. These satisfy the zod schema in
    // src/lib/utils/config.ts so any module that imports config (db
    // client, integrations, etc.) loads cleanly under vitest.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      SESSION_SECRET: "test-session-secret-padded-to-32-chars-yes",
      ALLOW_USERS: "test:$2b$10$abcdefghijklmnopqrstuv",
      OPENAI_API_KEY: "sk-test",
      ETSY_CLIENT_ID: "test-etsy-client",
      ETSY_CLIENT_SECRET: "test-etsy-secret",
      ETSY_REDIRECT_URI: "http://localhost:3000/api/etsy/oauth/callback",
      R2_ACCOUNT_ID: "test-account",
      R2_ACCESS_KEY_ID: "test-key",
      R2_SECRET_ACCESS_KEY: "test-secret",
      R2_BUCKET: "test-bucket",
      R2_PUBLIC_BASE_URL: "http://localhost:9000/test-bucket",
      WEBSITE_WEBHOOK_URL: "https://retrospectiva.example/api/revalidate",
      WEBSITE_WEBHOOK_SECRET: "test-website-webhook-secret-1234",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/app/**/layout.tsx",
      ],
    },
  },
});
