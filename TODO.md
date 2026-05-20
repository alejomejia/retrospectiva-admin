# TODO

Pending work, grouped by area. Live bookmark is `docs/handoff.md`;
historical record is `docs/roadmap.md`. This file is the actionable
checklist.

---

## 🔥 Active — Task 11: Per-product on-model image gen

Plan locked in [`docs/per-product-image-gen.md`](./docs/per-product-image-gen.md).
**Not started.** Start with schema migration.

### Schema (single migration)
- [ ] Add 6 columns to `products`: `aiModelId`, `aiSourcePanel`, `aiPosePreset`, `aiFramingPreset`, `aiEnvironmentPreset`, `aiFitOverride`
- [ ] Extend `image_role` enum with `'ai_reference'`
- [ ] Drop legacy `ai_run_kind` values: `description`, `era`, `title`, `tags`, `materials`, `taxonomy`, `when_made`
- [ ] Keep `model_placement` in `ai_run_kind` (already exists)

### Prompt assembly
- [ ] `src/lib/integrations/openai/image-placement-prompts.ts` — 7 module constants + `assembleImagePlacementPrompt`
- [ ] Garment-type → behavior block auto-mapping (incl. `set` → 3.5 + 3.5.1)
- [ ] Fit-override append logic (tight / loose / oversized / null)
- [ ] Env override per block (`IMAGE_PLACEMENT_*_PROMPT`)
- [ ] Add English-label field to `clothing-types.ts` for `{GARMENT_TYPE}` interpolation

### Worker + queue
- [ ] `src/lib/integrations/openai/image-placement.ts` — `runImagePlacement(productId)`
- [ ] `src/lib/integrations/openai/image-placement-worker.ts` — BullMQ glue
- [ ] Register `aiImagePlacementQueue` + `AiImagePlacementJob` in `src/lib/queue/queues.ts`
- [ ] Register worker in `src/lib/queue/worker.ts`
- [ ] Hard-delete prior `ai_model` row + R2 object before insert
- [ ] Log `ai_runs` with `kind='model_placement'` + accurate cost via `estimateImageCostUsd`

### Server actions + API
- [ ] `src/lib/products/image-placement-actions.ts` — `generateProductImage(productId, force?)`, `clearAiReferenceImage(productId)`, etc.
- [ ] `src/app/(admin)/products/[id]/ai-image-status/route.ts` — polling endpoint
- [ ] Extend `updateProductDraftField` in `draft-actions.ts` for new AI columns
- [ ] Extend `draft-schema.ts` (zod) for new fields

### UI (step 1 only for v1)
- [ ] `src/components/forms/new-product/ai-image-section.tsx` — designed for reuse
- [ ] `src/components/forms/new-product/use-image-placement-status.ts` — polling hook
- [ ] Mount section at bottom of `step-1-inputs.tsx`
- [ ] `kickedAt` skeleton pattern on Regenerar
- [ ] FailureBanner with Retry + Discard
- [ ] Labels in `messages.es.ts`
- [ ] Button disabled until model selected AND reference uploaded

### Tests
- [ ] `image-placement-prompts.test.ts` — every clothing-type → right behavior block, set incl. 3.5.1, fit-override variants, defaults
- [ ] `image-placement.test.ts` — mock `openai.images.edit`, R2 fetch, uploadToR2; assert skip on null model, hard-delete prior, correct order insert, run logged
- [ ] Extend `draft-actions.test.ts` for new AI columns

---

## ⏳ Phase 4c — Etsy publish processor (real)

Stub exists (Task 9). Replace `runScheduledPublish` only — worker glue stays.

- [ ] `createDraftListing` → upload images → upload video → inline `runTranslation` per translatable field → `state="active"`
- [ ] Listing-mapper for product → Etsy payload
- [ ] Filter `role='ai_reference'` images out of publish payload (only `original` + `ai_model`)
- [ ] E2E Playwright spec: login → create → publish → sale flow
- [ ] Etsy app approval (external blocker for smoke test)

---

## ⏳ Phase 7 — Webhooks

- [ ] Outbound to `retrospectiva-website` with HMAC, bilingual payload (`*_es` + `*_en`)
- [ ] Inbound Etsy receipts (poll-based primary, push optional)
- [ ] Republish-on-edit "dirty" flag + manual "Sincronizar con Etsy" action

---

## ⏳ Phase 8 — Dashboard

- [ ] Date-range picker (global filter)
- [ ] KPIs: revenue & sales, listings-by-status, recent activity feed
- [ ] Tremor `<AreaChart>` for sales sparkline + main chart
- [ ] Reads from `ai_runs.cost_usd` (now accurate post cost-estimator fix) + `events` table

---

## ⏳ Phase 9 — QoL

- [ ] Audit log UI (reads existing `events` table)
- [ ] Bulk CSV import
- [ ] Product duplicator
- [ ] Pending-sync badge
- [ ] Telegram notifier on sale
- [ ] Image manager
- [ ] Cost tracker UI
- [ ] Keyboard shortcuts on /products
- [ ] Bulk operations (multi-select archive/schedule/etc.)
- [ ] Column-header sorting on /products
- [ ] Orphan draft cleanup (sweep "Sin título" drafts > 7 days with no media)

---

## 🧹 Deferred follow-ups (tracked, not blocking)

- [ ] Shop-wide AI defaults page `/settings/ai` + `shop_settings` table (per-product columns become NULL-means-inherit)
- [ ] Per-product image-gen mount in **edit form** (for published products) — component built reusable in Task 11
- [ ] R2 orphan sweep job (model studio leaves orphan prefixes on regenerate)
- [ ] `markupPercent` migration from `etsy_oauth` → `shop_settings`
- [ ] Server-action integration tests with test DB

---

## 🔌 External / asset blockers

- [ ] `BRAND_VOICE_PROMPT` env value (user-supplied) — affects enrichment tone
- [ ] Etsy app approval (blocks 4c smoke test)

---

## 📐 Locked design rules (carry-forward — don't violate)

- Spanish-only admin. Translation runs **inline at Etsy publish boundary**, never on autosave or enrich. (`feedback_translate-at-publish-boundary`)
- All code in English. Spanish lives only in `messages.es.ts`. (`feedback_code-english-only`)
- Worker can't load `server-only` modules. Sanctioned exceptions in `docs/project-conventions.md` §1.
- R2 keys carry `{run_id}` segment for Model Studio. Cropper uploads under same prefix.
- Regenerate UX: always `kickedAt` local state → UI flips to skeleton before polling round-trip.
- shadcn/ui first for any UI primitive; custom only with `DESIGN_SYSTEM.md` §6 entry.
