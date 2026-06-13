import OpenAI from "openai";

/**
 * OpenAI SDK singleton. Cached on `globalThis` so HMR doesn't spin up
 * a new client on every reload.
 *
 * NOTE: this file intentionally does NOT `import "server-only"` and
 * reads `process.env` directly instead of going through
 * `@/lib/utils/config`. Reason: the BullMQ worker (`queue/worker.ts`)
 * runs under raw `tsx` where `server-only`'s react-server bundler
 * condition throws on import. The same `openai` singleton needs to
 * work in both Next.js server contexts and the worker. Client-bundle
 * protection is preserved because `openai` is a Node-only SDK that
 * fails to bundle into a client build anyway. Tracked alongside
 * `db/client.ts` and `queue/redis.ts` in
 * `docs/overview/project-conventions.md` §1.
 */

const globalForOpenAI = globalThis as unknown as {
  __retrospectivaOpenAI?: OpenAI;
};

export const openai =
  globalForOpenAI.__retrospectivaOpenAI ??
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (process.env.NODE_ENV !== "production") {
  globalForOpenAI.__retrospectivaOpenAI = openai;
}

/** Model IDs in one place so callers don't fish through env reads. */
export const MODELS = {
  text: process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
  translate: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini",
  image: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
} as const;

/**
 * Whether a model accepts the Responses API `reasoning` parameter.
 *
 * Only the reasoning families (gpt-5*, o1/o3/o4*) support it; non-reasoning
 * models like `gpt-4.1-mini` reject the request outright with
 * "reasoning not supported in this model", so callers must omit the
 * parameter rather than rely on it being ignored.
 *
 * @param model - The OpenAI model id (e.g. `gpt-4.1-mini`, `gpt-5-nano`).
 * @returns `true` when `reasoning` may be sent for this model.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[134])/.test(model);
}

/**
 * Builds the optional `reasoning` slice of a Responses API request,
 * gated on {@link isReasoningModel}. Spread into the request body so the
 * parameter is present only for models that accept it.
 *
 * @param model - The OpenAI model id the request targets.
 * @param effort - Reasoning effort; defaults to the cost-floor `minimal`.
 * @returns `{ reasoning: { effort } }` for reasoning models, else `{}`.
 */
export function reasoningParams(
  model: string,
  effort: "minimal" | "low" | "medium" | "high" = "minimal",
): { reasoning?: { effort: typeof effort } } {
  return isReasoningModel(model) ? { reasoning: { effort } } : {};
}
