import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { events, jobsIdempotency } from "@/lib/db/schema";

/**
 * Job lifecycle helpers shared by every BullMQ processor.
 *
 * Two concerns kept separate intentionally:
 *
 * 1. **Event logging** (`logJobEvent`). Inserts a row into the
 *    `events` table — the durable record consumed by the activity
 *    feed (Phase 8). Redis is ephemeral; `events` is the audit log.
 *
 * 2. **Idempotency** (`isJobProcessed` / `markJobProcessed`). Uses
 *    the `jobs_idempotency` table to prevent double-processing of
 *    naturally retryable inputs — webhook deliveries (Phase 7) and
 *    scheduled re-syncs being the obvious cases.
 *
 * Both are optional — each processor chooses what it needs.
 */

export type LogJobEventInput = {
  jobId: string | number | undefined;
  /** Dotted event type, e.g. `"etsy_publish.completed"`. */
  type: string;
  /** Optional product FK if the event is product-scoped. */
  productId?: string | null;
  /** Arbitrary structured payload — JSONB on disk. */
  payload?: Record<string, unknown>;
};

/**
 * Insert a job-lifecycle row into `events`. Safe to call from any
 * BullMQ processor; the `actor` is always `"worker"` so the
 * activity feed can distinguish job events from user actions.
 *
 * Failures here are non-fatal — we log the error and swallow it
 * so a logging hiccup never crashes an otherwise-successful job.
 *
 * @example
 *   await logJobEvent({
 *     jobId: job.id,
 *     type: "etsy_publish.completed",
 *     productId: job.data.productId,
 *     payload: { listingId: 12345 },
 *   });
 */
export async function logJobEvent(input: LogJobEventInput): Promise<void> {
  try {
    await db.insert(events).values({
      productId: input.productId ?? null,
      actor: "worker",
      type: input.type,
      payloadJson: {
        jobId: input.jobId == null ? null : String(input.jobId),
        ...(input.payload ?? {}),
      },
    });
  } catch (err) {
    // Logging failures must not break the job. `console.error` is
    // a sanctioned exception here — devError no-ops in production
    // and this line is the last-resort safety net.
    console.error("[queue.events-log] insert failed:", err);
  }
}

/**
 * Returns true if a row with `id = idempotencyKey` already exists
 * in `jobs_idempotency`. Processors call this at the top to
 * short-circuit when the job has already been handled (e.g. a
 * webhook redelivery).
 *
 * @example
 *   if (await isJobProcessed(`etsy-receipt:${receiptId}`)) {
 *     return { skipped: true };
 *   }
 */
export async function isJobProcessed(
  idempotencyKey: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jobsIdempotency.id })
    .from(jobsIdempotency)
    .where(eq(jobsIdempotency.id, idempotencyKey))
    .limit(1);
  return Boolean(row);
}

/**
 * Records `idempotencyKey` so future calls to `isJobProcessed`
 * return true. `purpose` is a short label (e.g. `"etsy-receipt"`,
 * `"website-revalidate"`) used to make the table self-describing
 * — multiple subsystems share the table.
 *
 * Uses `ON CONFLICT DO NOTHING` so calling this twice with the same
 * key is safe — the second call is a no-op.
 *
 * @example
 *   await markJobProcessed(`etsy-receipt:${receiptId}`, "etsy-receipt");
 */
export async function markJobProcessed(
  idempotencyKey: string,
  purpose: string,
): Promise<void> {
  await db
    .insert(jobsIdempotency)
    .values({ id: idempotencyKey, purpose })
    .onConflictDoNothing({ target: jobsIdempotency.id });
}

/**
 * Convenience: returns the number of rows in `jobs_idempotency`
 * matching `purpose`. Used by tests + future ops tooling to
 * sanity-check dedup state without exposing the raw table.
 */
export async function countProcessedJobs(purpose: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsIdempotency)
    .where(eq(jobsIdempotency.purpose, purpose));
  return row?.count ?? 0;
}
