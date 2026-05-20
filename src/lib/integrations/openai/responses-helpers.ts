/**
 * Shared helpers for callers of `openai.responses.create(...)`. The
 * Responses API can emit text either via the convenience
 * `output_text` field or interleaved in `output[].content[]`; the
 * `extractOutputText` walker handles both. `estimateCostUsd` carries
 * placeholder per-1M-token rates per model so `ai_runs.cost_usd`
 * stays close to truth across the gpt-5 and gpt-4o-mini callers.
 *
 * NOTE: no `import "server-only"` here, same reason as the rest of
 * this folder — these helpers run from both the Next runtime and
 * the raw-tsx BullMQ worker. See `docs/project-conventions.md` §1.
 */

import { devGroup } from "@/lib/utils/dev";

const cacheLog = devGroup("openai.cache");

/** Per-1M-token USD rates. Placeholder values until the Phase 8
 *  dashboard work pins them to live billing. Used for text models
 *  only — image models are flat-rate per call, see
 *  `IMAGE_RATES_USD_PER_CALL`. */
const RATES_USD_PER_M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  // gpt-5 family: $5/M input, $15/M output (placeholder).
  "gpt-5": { input: 5, output: 15 },
  // gpt-4o-mini: $0.15/M input, $0.60/M output (approx public).
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

/** Fallback for unknown text models — conservative middle-of-the-road. */
const FALLBACK_RATE = { input: 1, output: 3 };

/**
 * Image-generation pricing is **flat per call**, not token-based.
 * OpenAI's dashboard reports "completion tokens" for image models
 * but those are the encoded output bytes — the actual bill is a
 * fixed rate per (model, size, quality) tuple.
 *
 * Calling these "rates per call" rather than per-token avoids the
 * 10× under-estimation we hit when we tried to apply text-style
 * per-1M-token math to image models.
 *
 * Values are observed empirically (where we have data) + approx
 * from OpenAI's published pricing as of 2026. Refresh when pricing
 * actually changes; the dashboard work later can pin to live
 * billing. Keys match the strings we pass to `openai.images`.
 */
const IMAGE_RATES_USD_PER_CALL: Record<
  string,
  Record<string, Record<string, number>>
> = {
  // 1024×1024 = square; 1024×1536 = portrait; 1536×1024 = landscape.
  // Observed: gpt-image-2 high 1536×1024 = $0.167/call (May 2026).
  "gpt-image-2": {
    "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
    "1536x1024": { low: 0.016, medium: 0.063, high: 0.167 },
  },
};

/**
 * Extract the first text payload from a Responses API result. Falls
 * back to walking `output[].content[]` when the SDK doesn't expose
 * `output_text` directly (older SDK versions, certain streaming
 * shapes). Throws when neither path yields a non-empty string.
 */
export function extractOutputText(response: unknown): string {
  const r = response as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    output_text?: string;
  };
  if (typeof r.output_text === "string" && r.output_text !== "") {
    return r.output_text;
  }
  for (const block of r.output ?? []) {
    for (const piece of block.content ?? []) {
      if (
        piece.type === "output_text" &&
        typeof piece.text === "string" &&
        piece.text !== ""
      ) {
        return piece.text;
      }
    }
  }
  throw new Error("Responses API returned no output_text payload");
}

/**
 * USD cost estimate from the Responses-API `usage` block. Returns
 * null when usage is absent (test fixtures, certain error paths) so
 * `ai_runs.cost_usd` records a real number or nothing — never zero,
 * which would look like a free call in the dashboard.
 */
export function estimateCostUsd(
  model: string,
  response: unknown,
): string | null {
  const u = (
    response as {
      usage?: { input_tokens?: number; output_tokens?: number };
    }
  ).usage;
  if (!u) return null;
  const rate = RATES_USD_PER_M_TOKENS[model] ?? FALLBACK_RATE;
  const inputTok = u.input_tokens ?? 0;
  const outputTok = u.output_tokens ?? 0;
  const usd = (inputTok * rate.input + outputTok * rate.output) / 1_000_000;
  return usd.toFixed(6);
}

/**
 * USD cost for ONE call to `openai.images.generate` / `images.edit`.
 * Image models are billed flat per call, not per token, so this
 * lookup is keyed on the call parameters rather than reading the
 * response usage block (which lies for image models).
 *
 * Returns null when the (model, size, quality) tuple isn't in the
 * rate table — better than recording a wrong number that contaminates
 * the dashboard. Add new entries as you adopt new models / sizes.
 */
export function estimateImageCostUsd(input: {
  model: string;
  size: string;
  quality: string;
}): string | null {
  const cost =
    IMAGE_RATES_USD_PER_CALL[input.model]?.[input.size]?.[input.quality];
  if (typeof cost !== "number") return null;
  return cost.toFixed(6);
}

/**
 * Multi-line pretty log of prompt-cache utilization for a Responses
 * API call. OpenAI's cache is automatic + implicit (no opt-in); a
 * hit shows up as `usage.input_tokens_details.cached_tokens > 0`.
 *
 * Caching kicks in only when the prompt prefix is ≥1024 tokens, so
 * short prompts (e.g. translation) will always show 0 and that's
 * informative — the log line surfaces *why* explicitly.
 *
 * Dev-only via `devGroup`; the call is a no-op in production.
 */
export function logCacheUsage(input: {
  kind: string;
  model: string;
  response: unknown;
}): void {
  const u = (
    input.response as {
      usage?: {
        input_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      };
    }
  ).usage;
  const inputTokens = u?.input_tokens ?? 0;
  const cachedTokens = u?.input_tokens_details?.cached_tokens ?? 0;
  const cost = estimateCostUsd(input.model, input.response);
  const pct =
    inputTokens > 0 ? Math.round((cachedTokens / inputTokens) * 100) : 0;
  const note =
    inputTokens > 0 && inputTokens < 1024
      ? " — below 1024-token cache threshold"
      : "";

  cacheLog.log(
    `[ai-runs] ${input.kind} · ${input.model}\n` +
      `  input: ${inputTokens} tokens\n` +
      `  cached: ${cachedTokens} tokens (${pct}%${note})\n` +
      `  cost: ${cost ? `$${cost}` : "n/a"}`,
  );
}

/**
 * Multi-line pretty log for image-generation calls. The Images API
 * does not expose prompt-cache hit data, so this log is mostly a
 * uniform place-holder + cost line — useful for completeness when
 * scanning logs alongside text-API calls.
 */
export function logImageCallUsage(input: {
  kind: string;
  model: string;
  size: string;
  quality: string;
}): void {
  const cost = estimateImageCostUsd(input);
  cacheLog.log(
    `[ai-runs] ${input.kind} · ${input.model} (${input.size} ${input.quality})\n` +
      `  cost: ${cost ? `$${cost}` : "n/a"}\n` +
      `  note: images API does not report prompt cache hits`,
  );
}
