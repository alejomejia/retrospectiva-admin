#!/usr/bin/env tsx

/**
 * One-shot, idempotent backfill for `products.website_title_en` /
 * `products.website_title_es`.
 *
 * The storefront now shows a SHORT, human title (`website_title_*`)
 * instead of the long keyword-dense Etsy title (`title_*`) — see
 * `payload-mapper` + the `websiteTitleEn` enrichment field. New products
 * get it from the AI enrich pass; products enriched BEFORE the column
 * existed have it null (consumers fall back to the long Etsy title). This
 * script populates it for every legacy row:
 *
 *   1. EN — an OpenAI call shortens the existing `title_en` into a clean
 *      storefront title following the same rules the enrich prompt uses
 *      (no size, no keyword-stuffing, ~3-6 words). Grounding on the
 *      already-curated Etsy title keeps it consistent with the live
 *      listing and costs no image tokens.
 *   2. ES — only for rows that already have a `title_es` (i.e. published /
 *      translated products live on the website): the new short EN title is
 *      translated to `website_title_es` via the normal publish-boundary
 *      translator. Draft rows have their ES derived later at publish, per
 *      the translate-at-publish-boundary convention.
 *
 * Frozen slugs are intentionally NOT touched: already-published products
 * keep the slug they were first published with so shared / indexed URLs
 * stay valid. Only products published AFTER this change get a
 * website-title-based slug.
 *
 * Idempotent: only ever fills rows where `website_title_en IS NULL`, so it
 * is safe to re-run (a failed row is retried on the next run). Pass
 * `--dry-run` to preview counts, `--limit=N` to cap the batch.
 *
 * Usage (local):
 *   pnpm backfill:website-titles              # apply to all
 *   pnpm backfill:website-titles --dry-run    # preview only
 *   pnpm backfill:website-titles --limit=20   # first 20 rows
 *
 * On the VPS (inside the app/worker container, which has DATABASE_URL +
 * OPENAI_API_KEY):
 *   docker compose exec app pnpm backfill:website-titles
 */
import "@/lib/queue/env-bootstrap";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { MODELS, openai } from "@/lib/integrations/openai/client";
import { runTranslation } from "@/lib/integrations/openai/translate";
import {
  extractOutputText,
} from "@/lib/integrations/openai/responses-helpers";

const SHORTEN_SYSTEM = `You turn a long, keyword-dense Etsy vintage-clothing title into a SHORT, human storefront title for Retrospectiva's own website.

RULES:
- FORMULA: [optional decade] + [strongest descriptor(s)] + [garment type]. Example input "90s Floral Wrap Dress Size M, Orange Sleeveless Summer Dress with Tie Waist" -> "90s Floral Wrap Dress".
- Keep it SHORT: 3-6 words, max ~60 characters. Readable at a glance.
- Do NOT include the size, do NOT add a comma-separated second keyword phrase, do NOT keyword-stack.
- Keep the garment type, color, and era faithful to the input. Never invent attributes not in the input.
- Title Case, like a real product name. No pipes, no trailing punctuation.
- Output English only. Return a JSON object: {"value": "<short title>"}.`;

const STRING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { value: { type: "string", minLength: 5, maxLength: 70 } },
  required: ["value"],
} as const;

/** Shorten one long Etsy title to a clean storefront title (EN). */
async function shortenTitle(longTitle: string): Promise<string> {
  const response = await openai.responses.create({
    model: MODELS.text,
    input: [
      { role: "system", content: SHORTEN_SYSTEM },
      { role: "user", content: JSON.stringify({ value: longTitle }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ShortTitle",
        strict: true,
        schema: STRING_SCHEMA,
      },
    },
  });
  const parsed = JSON.parse(extractOutputText(response)) as { value?: unknown };
  if (typeof parsed.value !== "string" || parsed.value.trim() === "") {
    throw new Error("shorten output missing string `value`");
  }
  return parsed.value.trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const rows = await db
    .select({
      id: products.id,
      titleEn: products.titleEn,
      titleEs: products.titleEs,
    })
    .from(products)
    .where(
      and(isNotNull(products.titleEn), isNull(products.websiteTitleEn)),
    );

  const batch = limit != null ? rows.slice(0, limit) : rows;
  console.log(
    `[backfill] ${rows.length} rows need a website title` +
      (limit != null ? ` — processing first ${batch.length}` : ""),
  );

  if (batch.length === 0) {
    console.log("[backfill] nothing to do.");
    return;
  }
  if (dryRun) {
    console.log("[backfill] --dry-run: no changes written.");
    return;
  }

  let done = 0;
  let failed = 0;
  for (const row of batch) {
    const longTitle = (row.titleEn ?? "").trim();
    if (!longTitle) continue;
    try {
      const shortEn = await shortenTitle(longTitle);
      await db
        .update(products)
        .set({ websiteTitleEn: shortEn })
        .where(eq(products.id, row.id));

      // Only fill ES for already-translated (published) products; drafts
      // get ES at their publish boundary. `runTranslation` reads the
      // freshly-written `websiteTitleEn` and writes `website_title_es`.
      if ((row.titleEs ?? "").trim() !== "") {
        await runTranslation(row.id, "websiteTitleEn");
      }

      done++;
      console.log(`[backfill] ${row.id}  "${shortEn}"`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[backfill] FAILED ${row.id}: ${msg}`);
    }
  }

  console.log(
    `[backfill] done — ${done} populated, ${failed} failed (re-run to retry failures).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  });
