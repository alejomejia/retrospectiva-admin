// NOTE: env-bootstrap MUST be imported before anything that reads
// `process.env`. See its module-level docblock for why this is a
// separate file rather than a top-of-worker.ts call.
import "./env-bootstrap";

import { redis } from "./redis";

/**
 * BullMQ worker process entrypoint.
 *
 * Runs as a separate container (`docker compose up worker`) — same
 * image as the `app` service but a different CMD. Locally:
 * `pnpm worker` (with `tsx watch` for HMR-ish behavior).
 *
 * Each phase that needs background work adds a side-effect import
 * below. The import creates a BullMQ `Worker` instance that
 * subscribes to its Redis stream and processes jobs. The worker
 * file is responsible for its own queue declaration, processor,
 * and event logging via `events-log.ts` helpers.
 *
 * Currently NO workers are registered — Phase 5 ships the
 * infrastructure only. Phase 4c (Etsy publish), Phase 6 (AI
 * enrichment), and Phase 7 (webhooks + sale sync) will add their
 * own imports here.
 *
 * NOTE: `console.log` is the sanctioned exception in this file.
 * Workers are long-running daemons, not request-scoped code, so
 * the `devLog` helpers (which no-op in production) would render
 * the worker silent in prod — which is exactly when we need to
 * see startup, shutdown, and fatal lines in the container logs.
 */


const log = (...args: unknown[]) => console.log("[worker]", ...args);

async function main() {
  log("starting…");

  // Side-effect imports for each phase's workers go here.
  await import("@/lib/integrations/openai/enrich-worker"); // Task 6 (AI enrich)
  await import("@/lib/integrations/etsy/publish-worker"); // Task 9 stub (Phase 4c replaces)
  await import("@/lib/integrations/openai/model-generate-worker"); // Task 8 (Model Studio)
  // Coming next:
  //   await import("@/lib/integrations/openai/image-placement-worker"); // Task 11
  //   await import("@/lib/integrations/website/revalidate-worker"); // Phase 7

  log("ready");

  // Without any Worker instances, nothing else keeps the event loop
  // alive. Once Phase 4c+ adds real workers, their Redis
  // subscriptions take over and this heartbeat becomes redundant
  // (harmless to keep).
  setInterval(() => {}, 60_000);
}

async function shutdown(signal: NodeJS.Signals) {
  log(`received ${signal}, shutting down…`);
  try {
    await redis.quit();
  } catch (err) {
    console.error("[worker] redis.quit failed:", err);
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
