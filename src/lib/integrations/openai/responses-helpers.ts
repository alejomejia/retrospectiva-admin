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

/** Per-1M-token USD rates. Placeholder values until the Phase 8
 *  dashboard work pins them to live billing. */
const RATES_USD_PER_M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  // gpt-5 family: $5/M input, $15/M output (placeholder).
  "gpt-5": { input: 5, output: 15 },
  // gpt-4o-mini: $0.15/M input, $0.60/M output (approx public).
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

/** Fallback for unknown models — conservative middle-of-the-road. */
const FALLBACK_RATE = { input: 1, output: 3 };

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
