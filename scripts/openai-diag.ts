import { loadEnvConfig } from "@next/env";

// Load .env.local the same way the worker does, BEFORE importing the
// SDK — otherwise the SDK reads `process.env` while it's empty.
loadEnvConfig(process.cwd());

import OpenAI from "openai";

/**
 * One-shot OpenAI configuration diagnostic. Run with:
 *
 * pnpm exec tsx scripts/openai-diag.ts
 *
 * Prints every OPENAI_* env var the SDK sees (with the API key
 * truncated to a prefix), constructs the client the same way the
 * worker does, then runs two test calls:
 *
 *   1. `models.list()` — light call, equivalent to your earlier curl
 *   2. `responses.create()` — same endpoint the enrich processor uses
 *
 * The point is to isolate "SDK is fine, our code is broken" vs
 * "SDK call itself fails." Curl proves the key is good in isolation;
 * this proves whether the SDK adds something curl doesn't (e.g. a
 * stale org/project header from env).
 */

function show(label: string, value: string | undefined) {
  console.log(`  ${label.padEnd(22)} ${value ?? "(unset)"}`);
}

async function main() {
  console.log("Environment as the worker would see it:");
  show(
    "OPENAI_API_KEY",
    process.env.OPENAI_API_KEY
      ? `${process.env.OPENAI_API_KEY.slice(0, 12)}…(${process.env.OPENAI_API_KEY.length} chars)`
      : undefined,
  );
  show("OPENAI_ORG_ID", process.env.OPENAI_ORG_ID);
  show("OPENAI_ORGANIZATION", process.env.OPENAI_ORGANIZATION);
  show("OPENAI_PROJECT_ID", process.env.OPENAI_PROJECT_ID);
  show("OPENAI_BASE_URL", process.env.OPENAI_BASE_URL);
  show("OPENAI_TEXT_MODEL", process.env.OPENAI_TEXT_MODEL);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log("\nSDK client resolved:");
  // These are public-ish on the SDK; cast keeps TS happy across versions.
  const c = client as unknown as {
    organization?: string;
    project?: string;
    baseURL?: string;
  };
  show("  organization", c.organization);
  show("  project", c.project);
  show("  baseURL", c.baseURL);

  console.log("\n— /v1/models test —");
  try {
    const list = await client.models.list();
    const ids: string[] = [];
    for await (const m of list) {
      ids.push(m.id);
      if (ids.length >= 5) break;
    }
    console.log("  ✓ OK ·", ids.join(", "));
  } catch (e) {
    console.log(
      "  ✗ FAILED ·",
      e instanceof Error ? e.message : String(e),
    );
  }

  console.log("\n— /v1/responses test (gpt-4o-mini, 50 tokens) —");
  try {
    const r = (await client.responses.create({
      model: "gpt-4o-mini",
      input: "Say 'ok' in one word.",
      max_output_tokens: 50,
    })) as { output_text?: string };
    console.log("  ✓ OK ·", r.output_text ?? "(no output_text)");
  } catch (e) {
    console.log(
      "  ✗ FAILED ·",
      e instanceof Error ? e.message : String(e),
    );
  }
}

main().catch((err) => {
  console.error("diag fatal:", err);
  process.exit(1);
});
