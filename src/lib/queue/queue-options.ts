import type { JobsOptions } from "bullmq";

/**
 * Default job options applied to every queue.
 *
 * - **attempts: 3** — three tries before a job goes to the failed
 *   set. Most transient failures (Etsy 5xx, OpenAI 429, network
 *   hiccups) clear within seconds.
 * - **backoff exponential 1s** — retry after 1s, 2s, 4s. Tight
 *   enough that a flake recovers fast, slow enough not to amplify
 *   a real outage.
 * - **removeOnComplete after 24h** — keeps Redis memory bounded.
 *   The `events` table is the durable record; Redis only holds
 *   live job state.
 * - **removeOnFail after 7d** — failed jobs stay visible in the
 *   activity feed for a week so a human can investigate.
 *
 * Individual queues can override any of these per-queue or
 * per-job by passing their own `JobsOptions`.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
  },
};
