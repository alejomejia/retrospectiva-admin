import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright runs against the app at PLAYWRIGHT_BASE_URL (default
 * http://localhost:3000). It does NOT start its own webServer here — the
 * expected pattern is:
 *   $ docker compose up -d postgres redis
 *   $ pnpm dev &      # or pnpm build && pnpm start
 *   $ pnpm test:e2e
 *
 * That keeps E2E quick to iterate locally and lets CI bring up the full
 * stack with its own orchestration.
 *
 * NOTE: this file reads process.env directly (instead of
 * @/lib/utils/config) because it's a playwright CLI config — `pnpm
 * test:e2e` shouldn't require the full app environment to be set just
 * to run end-to-end tests.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
