import { Queue } from "bullmq";

import { redis } from "./redis";
import { DEFAULT_JOB_OPTIONS } from "./queue-options";

/**
 * Centralized BullMQ queue declarations. Each downstream phase
 * creates a Queue here + a worker file (`*-worker.ts`) that the
 * worker process imports for the subscription side.
 *
 * Producers (server actions, route handlers) import the Queue from
 * here and call `.add(...)`. Consumers import their own worker
 * file from `worker.ts` (side-effect import).
 *
 * Both producer and consumer share the same Redis connection
 * singleton + default job options (3 attempts, exponential backoff,
 * 24 h success retention, 7 d failure retention).
 */

/** AI enrichment for a draft product (title, description, tags,
 *  materials, era, taxonomy in a single Responses API call). */
export const aiEnrichQueue = new Queue("ai-enrich", {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export type AiEnrichJob = { productId: string };

/**
 * Etsy publish. Used by:
 *   - `scheduleProduct(id, when)` — enqueues a **delayed** job at
 *     `delay = when - now`, jobId = productId. BullMQ persists the
 *     delayed set in Redis so server restarts are safe.
 *   - Phase 4c on-demand publish — same queue, no delay.
 *
 * Currently the worker (`integrations/etsy/publish-worker.ts`) is a
 * stub that just flips `products.status` to 'published' locally. The
 * real Etsy push (createDraftListing → upload images → inline
 * `runTranslation` → state="active") lands in Phase 4c when the
 * stub is rewritten.
 */
export const etsyPublishQueue = new Queue("etsy-publish", {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export type EtsyPublishJob = { productId: string };
