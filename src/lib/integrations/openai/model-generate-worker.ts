import { Worker } from "bullmq";

import { logJobEvent } from "@/lib/queue/events-log";
import type { AiModelGenerateJob } from "@/lib/queue/queues";
import { redis } from "@/lib/queue/redis";

import { runModelGeneration } from "./model-generate";

/**
 * BullMQ worker for the `ai-model-generate` queue. Imported by
 * `src/lib/queue/worker.ts` as a side-effect.
 *
 * Thin glue around `runModelGeneration` — lifecycle events, console
 * tail, structured event-log writes for the activity feed. The
 * actual generation + cropping + R2 upload lives in
 * `./model-generate.ts`.
 *
 * Concurrency 2 because:
 *   - gpt-image-2 calls are slow (~30-60s) and we don't want a queue
 *     of model generations to serialize behind a single in-flight call.
 *   - Two parallel calls are well within OpenAI's RPM limit for
 *     image endpoints.
 *
 * NOTE: `console.log` is the sanctioned exception in worker files.
 */

const log = (...args: unknown[]) =>
  console.log("[ai-model-generate]", ...args);
const err = (...args: unknown[]) =>
  console.error("[ai-model-generate]", ...args);

new Worker<AiModelGenerateJob>(
  "ai-model-generate",
  async (job) => {
    const modelId = job.data.modelId;
    log(`started · model=${modelId} · job=${job.id}`);
    const t0 = Date.now();
    await logJobEvent({
      jobId: job.id,
      type: "ai-model-generate.started",
    });
    try {
      await runModelGeneration(modelId);
      const ms = Date.now() - t0;
      log(`completed · model=${modelId} · ${ms}ms`);
      await logJobEvent({
        jobId: job.id,
        type: "ai-model-generate.completed",
        payload: { modelId, durationMs: ms },
      });
      return { ok: true };
    } catch (e) {
      const ms = Date.now() - t0;
      const message = e instanceof Error ? e.message : String(e);
      err(`failed · model=${modelId} · ${ms}ms · ${message}`);
      await logJobEvent({
        jobId: job.id,
        type: "ai-model-generate.failed",
        payload: { modelId, error: message, durationMs: ms },
      });
      throw e;
    }
  },
  { connection: redis, concurrency: 2 },
);

log("registered worker for queue: ai-model-generate");
