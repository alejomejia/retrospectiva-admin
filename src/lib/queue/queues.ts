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

/**
 * Outbound webhook to the public `retrospectiva-website` repo. The
 * website consumer revalidates its product cache and updates the
 * store. Producers:
 *   - `publish` — the Etsy publish processor surfaces a new listing.
 *   - `update`  — operator edits an already-published product and
 *                 pushes the revised data (re-translated ES→EN).
 *   - `sold`    — operator manually marks a product sold (still shown
 *                 on the store, flagged sold).
 *   - `archive` — operator pulls a product that wasn't sold.
 *
 * Each enqueue uses an auto-generated jobId (no custom id). An earlier
 * `${kind}-${productId}` jobId coalesced re-pushes, but BullMQ ignores
 * `add()` for a jobId still present in Redis — including a COMPLETED job
 * retained by `removeOnComplete` (24 h). That silently dropped every
 * repeat action on a product within the window (a second "update website"
 * did nothing). The webhook rebuilds its payload from current state and is
 * idempotent, so a fresh job per action is both correct and safe.
 */
export const websiteWebhookQueue = new Queue("website-webhook", {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export type WebsiteWebhookKind = "publish" | "update" | "archive" | "sold";

export type WebsiteWebhookJob = {
  productId: string;
  kind: WebsiteWebhookKind;
};

/**
 * Product-video transcode. The browser uploads the RAW clip straight to
 * R2 (presigned PUT — the app server never buffers it), then enqueues a
 * job here. The worker (`src/lib/products/transcode-worker.ts`) streams
 * the raw object to disk, runs ffmpeg → 1080p H.264/MP4, streams the
 * result back to R2, flips the `product_videos` row to `ready`, and
 * sweeps the raw temp object.
 *
 * jobId = `product_videos.id` so a re-finalize of the same row coalesces
 * onto one job instead of stacking duplicate transcodes.
 */
export const videoTranscodeQueue = new Queue("video-transcode", {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export type VideoTranscodeJob = { videoId: string };

/**
 * Periodic reaper for abandoned video uploads. A row stuck `processing`
 * well past a normal transcode means the browser uploaded the raw clip to
 * R2 but never called `finalizeVideoUpload` (e.g. the tab closed between
 * the PUT and the finalize), so no transcode job exists and the row + its
 * raw R2 object would linger forever. The worker
 * (`video-reaper-worker.ts`) registers a repeatable job on this queue and
 * sweeps them on a schedule.
 */
export const videoReaperQueue = new Queue("video-reaper", {
  connection: redis,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export type VideoReaperJob = Record<string, never>;
