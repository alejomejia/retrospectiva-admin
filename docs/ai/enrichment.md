# AI enrichment

How the admin uses OpenAI to fill in the Etsy-listing content from a
product photo + users manual inputs. This is what the older
roadmap called "Phase 6"; the implementation lands alongside the
product form rebuild (see [product-form.md](../product/form.md)).

The UX side of this lives in step 2 of the new-product stepper. This
doc focuses on the **pipeline**: prompts, queues, structured outputs,
image generation, and cost/audit tracking.

---

## 1 · Pipeline shape

Everything is queued. The stepper UI doesn't block on OpenAI — it
enqueues a job and polls for completion. Per-field regenerates use the
same pattern.

```
                    ┌──────────────────────┐
   step 1 → Next ─► │  enqueue ai-enrich   │ ─► returns immediately
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │ ai-enrich processor  │         │ ai-image-placement   │
   │ (text + structured)  │         │ (gpt-image-2)        │
   └──────────┬───────────┘         └──────────┬───────────┘
              │                                │
              ▼                                ▼
   updates product columns           uploads to R2, inserts
   logs ai_runs row(s)               product_images row (role='ai_model')
                                     logs ai_runs row

   step 2 polls /products/[id]/ai-status until both are done.
```

Per-field regenerates:

```
"🔄 regenerar"  ─►  enqueue ai-regenerate (field, productId)
                    processor runs a targeted single-field call
                    updates that one column
                    logs ai_runs row
```

Translation (inline at the publish boundary, **NOT on autosave**):

```
Phase 4c publish processor for product P:
  for field in TRANSLATABLE_FIELDS:
    runTranslation(P, field)        # synchronous; one ai_runs row
  → updateListingTranslation(...)   # uses the freshly-written *_en columns
```

Admin UI is Spanish-only. The shop owner doesn't read English, so
paying for translations on autosave / enrich-success would burn
tokens on content that may never publish. The `*_en` columns are a
cache of what we last sent to Etsy.

---

## 2 · Queues

All BullMQ, all consumed by `src/lib/queue/worker.ts` via
side-effect imports.

| Queue | Job shape | Processor location |
| --- | --- | --- |
| `ai-enrich` | `{ productId }` | `src/lib/integrations/openai/enrich-worker.ts` |
| `ai-regenerate` | `{ productId, field }` | `src/lib/integrations/openai/regenerate-worker.ts` |
| `ai-image-placement` | `{ productId }` | `src/lib/integrations/openai/image-placement-worker.ts` |
| `etsy-publish` | `{ productId }` | `src/lib/integrations/etsy/publish-worker.ts` (Phase 4c, stub until then) |

Translation **does not have its own queue**. It runs inline inside
the Phase 4c `etsy-publish` processor — one `runTranslation` call
per translatable field, sequentially, just before
`updateListingTranslation`.

Default options come from `src/lib/queue/queue-options.ts` (3
attempts, exponential backoff, 24h success retention, 7d failure
retention).

---

## 3 · Models

| Use | Model | Why |
| --- | --- | --- |
| Full enrichment (title + description + tags + materials + era + taxonomy) | `gpt-5` via Responses API with structured output | Vision-capable, follows JSON schemas reliably. |
| Per-field regenerate | same `gpt-5` | Reuses the same prompt scaffolding for consistency. |
| Translation (ES ↔ EN) | `gpt-4o-mini` | Cheap, fast, more than good enough for short product copy. |
| Model placement image | `gpt-image-2` | User-specified. Two-image input (model photo + product photo). |

Model IDs are env-overridable via `OPENAI_MODEL_TEXT`,
`OPENAI_MODEL_TRANSLATE`, `OPENAI_MODEL_IMAGE`. Defaults in
`src/lib/utils/config.ts`.

---

## 4 · Prompts

All prompt templates live in `src/lib/integrations/openai/prompts.ts`,
each as a named export. Every template is env-overridable via the
matching `_PROMPT` env var so iteration on tone doesn't need a
deploy:

| Template | Env override | Purpose |
| --- | --- | --- |
| `BRAND_VOICE` | `BRAND_VOICE_PROMPT` | Tone/voice rules — appended to title + description prompts. |
| `ENRICH_TITLE` | `ENRICH_TITLE_PROMPT` | "Generate a Spanish title for this vintage garment…" |
| `ENRICH_DESCRIPTION` | `ENRICH_DESCRIPTION_PROMPT` | Multi-paragraph product description in Spanish. |
| `ENRICH_TAGS` | `ENRICH_TAGS_PROMPT` | Up to 13 Spanish tags. |
| `ENRICH_MATERIALS` | `ENRICH_MATERIALS_PROMPT` | Best-guess material list in Spanish. |
| `ENRICH_ERA` | `ENRICH_ERA_PROMPT` | Pick one of Etsy's `when_made` values. |
| `ENRICH_TAXONOMY` | `ENRICH_TAXONOMY_PROMPT` | Pick one taxonomy ID from the curated list. |
| `TRANSLATE_ES_EN` | `TRANSLATE_ES_EN_PROMPT` | Translate a single string ES→EN. |
| `IMAGE_PLACEMENT` | `IMAGE_PLACEMENT_PROMPT` | Place the garment on the model. Includes a `{location}` placeholder. |

The image-placement prompt has a `{location}` placeholder filled by a
random pick from `LOCATION_POOL` (also in `prompts.ts`, also
env-overridable via `LOCATION_POOL` as a comma-separated list).

---

## 5 · Structured output schema

The enrichment call uses the Responses API with a zod-validated JSON
schema. Defined in `src/lib/integrations/openai/schemas.ts`:

```ts
const EnrichmentOutput = z.object({
  titleEs: z.string().min(10).max(140),
  descriptionEs: z.string().min(40).max(2000),
  etsyTagsEs: z.array(z.string()).max(13),
  etsyMaterialsEs: z.array(z.string()).max(13),
  etsyWhenMade: z.enum([
    '1990s', '1980s', '1970s', '1960s', '1950s', 'before_1950',
  ]),
  etsyTaxonomyId: z.number().int(), // validated against the curated list
});
```

The processor:

1. Loads product + first image (R2 → signed URL).
2. Builds the messages array with the system prompt + brand voice +
   garment context (type, condition, sizes, measurements).
3. Calls `openai.responses.create({ response_format: { type:
   'json_schema', json_schema: EnrichmentOutput } })`.
4. Validates with zod (`safeParse`).
5. Writes each field to `products`.
6. Enqueues an `ai-translate` job per text field for the EN
   counterpart.
7. Inserts an `ai_runs` row per call with `kind`, `model`,
   `input_json`, `output_json`, `cost_usd`.

---

## 6 · Image placement

`src/lib/integrations/openai/image-placement.ts`:

1. Lists objects in R2 under `assets/models/`. Picks one at random.
2. Picks a location string at random from `LOCATION_POOL`.
3. Calls `openai.images.edit` (gpt-image-2) with both images and the
   filled prompt.
4. Receives an image (base64 or URL). Uploads to R2 under
   `products/{YYYY}/{MM}/{DD}/{productId}/ai_model/{uuid}.jpg` with
   1-year `Cache-Control` (same convention as Phase 3).
5. If a previous `role='ai_model'` row exists for this product:
   delete it from R2, delete the DB row.
6. Insert the new `product_images` row with `role='ai_model'`, `order
   = MAX(order) + 1` so it lands at the end of the gallery.
7. Insert an `ai_runs` row with `kind='model_placement'`.

The model image pool lives at `assets/models/*.jpg` in R2. The
production set will be uploaded by the user later. For development
and smoke tests, `scripts/seed-model-images.ts` uploads 1-2 placeholder
images (committed under `public/dev/models/` so they're available in
any clone).

---

## 7 · Bilingual handling

The admin UI is Spanish. The user only edits the ES side; the EN
counterparts are filled by `runTranslation` at the Etsy-publish
boundary.

- **Admin never displays EN.** No EN collapsibles, no per-field
  badges, no manual EN tweaks. The shop owner doesn't read English
  and can't validate the output, so we trust the model 1:1.
- **Translation runs inline in the Phase 4c publish processor.** For
  each `TRANSLATABLE_FIELDS` entry (titleEs, descriptionEs,
  etsyTagsEs, etsyMaterialsEs), the processor calls
  `runTranslation(productId, field)` synchronously, writes the
  result to the matching `*_en` column, and only then calls Etsy's
  `updateListingTranslation`. Arrays are translated as a whole via
  structured output (a `{ items: string[] }` schema enforces
  same-length output to preserve index alignment).
- **Republish on edit is explicit.** If the user edits an ES field
  on an already-published product, a "Sincronizar con Etsy" action
  re-runs the translate + push. There is no auto-republish — buyers
  see intermediate edits only when the user confirms.
- **Empty source clears the EN cache.** A null/empty ES value writes
  null (string) or `[]` (array) directly without an API call.
- **`*_en` columns are a cache, not a source of truth.** The website
  webhook (Phase 7) reads them when delivering the bilingual payload;
  any time the cache might be stale (post-edit), the publish path
  refreshes it before sending.

---

## 8 · Cost + audit (`ai_runs`)

Every OpenAI call inserts an `ai_runs` row. The schema is already in
place (see `src/lib/db/schema.ts`):

```
ai_runs(id, product_id, kind, status, model, input_json,
        output_json, cost_usd, error, created_at, finished_at)
```

`kind` enum is expanded for this work:

- `title`, `description`, `tags`, `materials`, `era`, `taxonomy`,
  `translation`, `model_placement`.

Existing `description` / `era` / `model_placement` values stay valid.

Cost is recorded as a string (USD with 4 decimals). The Phase 8
dashboard surfaces a monthly total + per-product breakdown for free
once `ai_runs` is being written.

A small "Coste IA: $0.XX" badge appears at the top of step 2 in the
stepper, summing the rows for the current product.

---

## 9 · Failure handling

Per the locked decision, failures **never block publishing**:

- `ai-enrich` job fails: step 2 still renders with empty AI fields and
  a top-of-page banner ("La IA falló. Puedes rellenar a mano o
  reintentar"). The "Reintentar todo" button re-enqueues. The user
  can also fill every field by hand.
- `ai-image-placement` job fails: the AI image slot stays empty. A
  small "Regenerar imagen" button appears under it; nothing else is
  affected.
- `ai-regenerate` fails: the field reverts to its prior value with a
  toast.
- `ai-translate` fails: the EN field shows its prior value; a small
  warning icon next to the collapsible offers a manual retry.

BullMQ retry semantics (3 attempts, exponential backoff) cover
transient OpenAI 5xx / rate-limit responses before the UI sees a
failure.

---

## 10 · Open assets (provided by the user)

| Asset | Where | When needed |
| --- | --- | --- |
| `BRAND_VOICE_PROMPT` text | `.env.local` | Before enrichment ships |
| Model images (6-12 full-body shots, front + sides) | R2 `assets/models/` | Before image-placement ships |
| Production-grade location pool | `LOCATION_POOL` env or `prompts.ts` default | Before image-placement ships |
| Curated Etsy taxonomy short list (10-15 leaf IDs) | `src/lib/integrations/etsy/taxonomy.ts` | I draft, user reviews |

Until each item is provided, the pipeline uses sensible placeholders
and the smoke test still passes.

---

## 11 · Polling endpoint

`GET /products/[id]/ai-status` returns:

```ts
{
  enrich: { status: 'pending' | 'running' | 'succeeded' | 'failed',
            error: string | null,
            finishedAt: string | null } | null,
}
```

Image-placement will join when Task 11 lands. Translation is **not**
surfaced here — it runs synchronously inside the publish processor,
so there's no async per-field state for the UI to poll.

Backed by `latestRunForKind(productId, "enrich")`. The stepper polls
every 2.5 s on step 2 until the enrich run is `succeeded` or
`failed`.

---

## 12 · Testing strategy

- **Unit (vitest)**: prompt templates produce valid messages;
  structured-output schema parses fixture JSON; ES→EN translation
  function returns a string; image-placement honors the "delete prior
  ai_model" rule.
- **MSW**: all OpenAI HTTP is intercepted in tests (`src/test/msw/`).
  Fixtures live under `src/test/fixtures/openai/`.
- **No live OpenAI calls in CI**. The smoke E2E uses MSW-mocked
  responses so we still exercise the end-to-end stepper UX.
