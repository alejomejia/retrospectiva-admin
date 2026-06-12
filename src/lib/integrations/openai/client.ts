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
