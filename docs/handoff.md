# Session handoff

Transient state — "where we are right now, what's the immediate next
move." Updated by Claude sessions as work progresses.

The other docs (`roadmap.md`, `architecture.md`, etc.) are the stable
historical record. **This file is the bookmark.**

---

## Current state (2026-05-19)

**Phase 6 (product form + AI enrichment) is feature-complete.** The
in-flight bucket finished as agreed: translation primitive,
scheduled-publish queueing, tests + smoke checklist. Then the "new
bucket" landed too: **Model Studio shipped** (`/models` admin
section, gpt-image-2 generation, gutter-detect cropping + retry-crop).
Several smaller fixes piled on top (idempotent enrich + Regenerar,
auto-derived Etsy taxonomy, prompt tightening, R2 run-id versioning
for cache-busting, cost estimator fix for image models).

**Test suite: 289/289. Typecheck clean. Lint 0 errors. `pnpm build` green.**

**The next active task is Task 11 — Per-product on-model image gen**,
plan finalized with the user, **not yet started**. Full plan is in
[per-product-image-gen.md](./per-product-image-gen.md). Read that
before writing code.

### Resume prompt

Paste into a new Claude Code session in this repo:

> Read `docs/handoff.md` first, then `docs/per-product-image-gen.md`
> for the locked Task 11 plan. That's the immediate next work. Don't
> re-litigate the design — it's signed off. Start with the schema
> migration.

That's all the next session needs. `AGENTS.md` auto-loads. The
roadmap doc has the broader context if needed.

---

## What just shipped (recap of the most recent work)

### Task 7 — Translation primitive (at-publish boundary)

- `runTranslation(productId, field)` in `src/lib/integrations/openai/translate.ts` — `gpt-4o-mini`, structured JSON output, array length-drift rejection, empty-source clear.
- **NOT** triggered on autosave or after enrich. Called inline by the Phase 4c publish processor (which is the Task 9 stub today; real one lands later).
- Admin UI is Spanish-only. No EN collapsibles, no per-field badges. The shop owner doesn't read English and can't validate the output, so we trust the model 1:1.
- Rolled back an earlier per-keystroke implementation. The reasons + design rule are stored in `~/.claude/projects/.../memory/feedback_translate-at-publish-boundary.md`.

### Task 9 — Scheduled-publish queueing

- `etsyPublishQueue` declared. `scheduleProduct` enqueues a delayed job with `delay = target - now`, `jobId = productId`, remove-then-add for re-scheduling.
- `cancelSchedule` removes the delayed job; swallows "job is active" for the cancel-while-firing race.
- Worker (`src/lib/integrations/etsy/publish-worker.ts`) is a **stub** — re-reads the row, flips `status='published'` if still scheduled (race-safety check trumps a late-arriving cancel). Real Etsy push lands in Phase 4c and replaces only the `runScheduledPublish` function in `publish.ts`, not the worker glue.

### Task 10 — Tests + smoke + verifiers

- `runScheduledPublish` extracted from the worker into `publish.ts` so the race-safety logic is unit-testable.
- `docs/smoke-test.md` — 20-minute manual checklist for Phase 6 shipment. Covers boot, auth, list view, stepper happy path with idempotency check, scheduled publish (incl. the cancel race), edit form, known out-of-scope items.

### Task 8 — Model Studio

- `/models` admin section (sibling of `/products`). Gallery with active/draft/archived tabs.
- Generation form mirrors ChatGPT's 4-section IA: **Identidad (Base)** active, **Prenda / Pose / Entorno** scaffolded as visible-but-disabled placeholders.
- Worker: `gpt-image-2` at `quality='high'`, `size='1536x1024'`. Contact sheet uploaded to R2; gutter-detect cropping carves 6 panels with graceful fallback (sheet-only when detection fails).
- **Crop algorithm hybrid**: horizontal middle gutter detected by projection (works); vertical splits use equal-thirds + a "split line is mostly white" sanity check (column-projection detection was retired — too fragile for narrow standing-pose figures). See `src/lib/integrations/openai/grid-crop.ts` docblock.
- Lifecycle: `draft → active → archived`. Discard hard-deletes (DB row + R2 prefix). Archive keeps the row for provenance.
- Polling endpoint + hook (`useModelGenerationStatus`) drives the detail page state machine.

### Task 12 — Idempotent enrich + Regenerar

- `enqueueEnrichJob(id, { force? })` skips when the latest `ai_runs` row of `kind='enrich'` is `succeeded`. Step 1 → step 2 navigation no longer re-runs enrich every time.
- Regenerar button in `AiContentSection` (shared by step 2 + edit form). Step 2 uses a unified `kick` (retry-after-failure and regenerate-after-success both call `enqueueEnrichJob({ force: true })`). Edit form has on-click polling + `window.confirm` warning before regenerating live content.
- `runEnrichment` now bumps `products.updatedAt` so the `AiContentSection` key remounts after regenerate.

### Task 13 — Auto-derive Etsy taxonomy

- The taxonomy picker was removed from step 2 / `AiContentSection`. Each `clothing_type` carries an `etsyTaxonomyKey` in the registry (`src/lib/products/clothing-types.ts`).
- `updateProductDraftField` derives `etsyTaxonomyId` server-side whenever `clothingType` is in the patch. The user never picks a taxonomy.
- AI enrichment schema dropped `etsyTaxonomyKey` (one less field for the model to fill).
- Step 3 (summary) lost the redundant raw-id taxonomy cell; section header renamed from "Categoría Etsy" to "Detalles de Etsy".

### Post-Task-8 fixes (the long tail)

- **R2 path versioning** — `assets/models/{model_id}/{run_id}/...` instead of `assets/models/{model_id}/...`. Each regeneration writes to a fresh path so browser + Cloudflare cache can't serve old bytes when the same key is overwritten. Old prefixes become orphans (cheap; future sweep job).
- **Skeleton-on-Regenerar** — Detail view uses a `kickedAt` timestamp state to flip immediately to skeleton when the user clicks Regenerar, before polling has a chance to see the new run row. Same pattern as `step-2-ai-review.tsx`.
- **Retry-crop button** — `retryCropModel(id)` action. Downloads the existing sheet from R2, re-runs `cropPanelsFromSheet`, uploads panels under the same run-id prefix. Useful for old `cropsAvailable=false` rows after a crop-algorithm tweak. Button shows only when `model.contactSheetKey && !model.cropsAvailable`.
- **Prompt tightening (Phase 1 base model)** — Added "figures occupy full vertical height" + "40px gutters" to the prompt. Empirically improved gutter cleanliness in `gpt-image-2` output.
- **Cost estimator** — image models are flat-rate per call, not token-based. New `estimateImageCostUsd({ model, size, quality })` in `responses-helpers.ts`; the old `estimateCostUsd` (token-based) was off by ~10× for image gen. Backfilled the 7 existing `model_generation` rows from $0.017 → $0.167 each so `ai_runs.cost_usd` now matches the OpenAI dashboard.

### Locked design rules (carry-forward)

- **Spanish-only admin.** Translations run at the Etsy-publish boundary. No EN UI anywhere except future "manage translations" admin (not in scope yet). Memory: `feedback_translate-at-publish-boundary`.
- **All code in English.** Identifiers, URL params, registry keys, in-code labels — never Spanish. Spanish lives only in `messages.es.ts`. Memory: `feedback_code-english-only`.
- **Worker can't load `server-only` modules.** Sanctioned exceptions in `docs/project-conventions.md` §1 (db/client, queue/redis, openai/client, openai/prompts, r2/client, r2/upload — these read `process.env` directly, skipping `config`). When adding new worker-reachable code, follow the same pattern.
- **R2 keys carry the `{run_id}` segment** for the Model Studio. Each generation has its own prefix. Cropper uploads to the same prefix as the sheet it came from.
- **Regenerate UX**: always a `kickedAt` local state so the UI flips to skeleton/loading before polling round-trip, then settles when polling reflects a run with `finishedAt > kickedAt`.

### Open follow-ups (tracked, not blocking)

- Shop-wide AI defaults page (`/settings/ai`). Per-product columns documented in [per-product-image-gen.md](./per-product-image-gen.md) §schema; the settings UI / `shop_settings` table is deferred but in the plan.
- Per-product image-gen mounting in the edit form (for already-published products). Component will be built reusable; second mount is a follow-up.
- Etsy publish processor (Phase 4c) — replace the Task 9 stub with the real `createDraftListing → upload media → inline runTranslation → state="active"` flow.
- Webhook out to public website (Phase 7) — bilingual payload.
- Dashboard (Phase 8) — Tremor charts on `ai_runs` cost data (now accurate!).
- `BRAND_VOICE_PROMPT` env value still empty — affects enrichment tone. User-supplied asset.

### State of the world right now

```
src/lib/db/migrations/  → 0000…0004 applied
ai_models table         → exists, 4 active rows (per latest local DB)
ai_runs                 → 11 rows total (7 model_generation + 4 enrich)
queues registered       → ai-enrich, etsy-publish (stub), ai-model-generate
queues NOT registered   → ai-translate (inline, no queue), ai-image-placement (Task 11)
routes                  → /, /login, /products, /products/[id], /products/new, /products/[id]/ai-status, /models, /models/[id], /models/[id]/generation-status, /models/new, /settings/etsy, plus the /api/* routes
```

---

## Maintenance norm

Update this file when:
- Mid-task scope changes (e.g. after answering one of the three
  questions, narrow it to the chosen path).
- A session is ending with non-trivial state to carry forward.
- A task moves from `in_progress` to `completed` (clear the
  in-progress notes here; roadmap.md absorbs the history).

When everything's between tasks and there's no live scope decision,
this file can be just a one-liner ("Task 11 next. Plan locked.") or
even empty. **Don't let it bloat** — `roadmap.md` is the historical
record; this is the bookmark.
