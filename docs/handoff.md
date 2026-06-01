# Session handoff

Transient state — "where we are right now, what's the immediate next
move." Updated by Claude sessions as work progresses.

The other docs (`roadmap.md`, `architecture.md`, etc.) are the stable
historical record. **This file is the bookmark.**

---

## Current state (2026-05-30)

**Phases 0–6, 6.5, 4c, and Task 11 are all done.** Etsy app is
approved; OAuth + first publish smoke confirmed. Etsy publish runs
the real `createDraftListing → upload images/video → inline
runTranslation → state="active"` flow. Per-product on-model image
generation (Task 11) shipped end-to-end, mounted in step 1. Outbound
webhook to `retrospectiva-website` ships with HMAC + bilingual
payload. `/settings/ai` shop-wide defaults page shipped (was a
deferred follow-up).

**Test suite green. Typecheck clean. `pnpm build` green.**

### Next active work

**Phase 7 — close the sale loop (inbound Etsy receipts polling).**
Outbound webhook to the website is already done; what's missing is
the receipt-polling side that flips a product to `archived` when it
sells. No code exists for this yet — `getShopReceipts` is not wired,
no receipts queue, no cron.

After that: **Phase 8 (Dashboard)** then **Phase 9 (QoL drip)**.

### Resume prompt

Paste into a new Claude Code session in this repo:

> Read `docs/handoff.md` first, then `docs/roadmap.md` for context.
> Next active work is Phase 7 inbound Etsy receipts polling — sale
> detection that flips products to `archived`. Outbound webhook is
> done; this is the inbound side.

`AGENTS.md` auto-loads.

---

## Shipped since the last handoff (2026-05-19 → 2026-05-30)

### Phase 4c — Etsy publish processor (real)

- `publish.ts` runs the real flow: `createDraftListing` →
  `uploadListingImage` per image → `uploadListingVideo` → inline
  `runTranslation` per translatable field → `updateListing({ state:
  "active" })`. Race-safety status guard preserved from the Task 9
  stub.
- Listing-mapper covers Etsy colors, sizes, shipping weight class,
  preparation time, featured rank.
- OAuth + first publish smoke run confirmed against the live Etsy
  app (approval done).
- E2E Playwright spec still TODO (no `e2e/` dir yet).

### Etsy update flow

- `etsyUpdateQueue` + `update.ts` + `update-worker.ts`. Re-translates
  ES → EN, pushes full payload via `updateListing`, re-syncs images +
  video against the existing listing. `jobId = "update:${productId}"`
  so back-to-back clicks coalesce.

### Phase 7 outbound webhook

- `src/lib/integrations/website/`: `payload-mapper.ts`, `sign.ts`
  (HMAC), `client.ts`, `webhook-worker.ts`. Bilingual `*_es` + `*_en`
  payload to `retrospectiva-website`.
- Inbound side (Etsy receipts polling) still pending — see next-work
  section above.

### Task 11 — per-product on-model image gen

- `image-placement-prompts.ts` (7-module assembly + garment-type
  behavior mapping + fit-override append + env overrides).
- `image-placement.ts` worker function consuming `ai_models` rows.
- `image-placement-worker.ts` BullMQ glue.
- `aiImagePlacementQueue` registered in `queues.ts`.
- Server actions in `src/lib/products/image-placement-actions.ts`.
- Polling route `/api/products/[id]/ai-image-status`.
- UI mounted at bottom of step 1 (`ai-image-section.tsx` +
  `use-image-placement-status.ts`). Edit-form mount is a follow-up.
- Schema: 6 `products.ai*` columns, `ai_reference` image role,
  legacy `ai_run_kind` values dropped.

### `/settings/ai` shop-wide defaults

- Page shipped. Per-product columns inherit when null (the
  `shop_settings` deferred follow-up).

### Other shipped

- `/settings/products`, `/settings/integrations` pages.
- 16 new migrations (0005 → 0020) covering Etsy colors, sizes,
  shipping weight class, featured rank, etc.

---

## What's left

### ⏳ Phase 7 — inbound (sale loop)

- [ ] `getShopReceipts` polling (cron / interval job)
- [ ] Sale handler: flip `status='archived'`, emit `events` row
- [ ] Optional Etsy push webhook receiver (beta — not required if
      polling is reliable)
- [ ] Verify republish-on-edit UI: "Sincronizar con Etsy" button is
      mounted in edit form and feeds `etsyUpdateQueue` (queue +
      worker exist; confirm UI side)

### ⏳ Phase 4c — final polish

- [ ] E2E Playwright spec in `e2e/`: login → create → publish → sale

### ⏳ Phase 8 — Dashboard

Root `(admin)/page.tsx` still the Phase 2 minimal landing.

- [ ] Date-range picker (global filter)
- [ ] KPIs: revenue & sales, listings-by-status, recent activity feed
- [ ] Tremor `<AreaChart>` sparkline + main chart
- [ ] Cost view reading `ai_runs.cost_usd`

### ⏳ Phase 9 — QoL drip

- [ ] Audit log UI (reads `events`)
- [ ] Bulk CSV import
- [ ] Product duplicator
- [ ] Pending-sync badge
- [ ] Telegram notifier on sale (depends on Phase 7 inbound)
- [ ] Image manager
- [ ] Cost tracker UI
- [ ] Keyboard shortcuts on /products
- [ ] Bulk operations (multi-select archive/schedule)
- [ ] Column-header sorting on /products
- [ ] Orphan draft cleanup ("Sin título" drafts > 7d with no media)

### 🧹 Deferred follow-ups (tracked, not blocking)

- [ ] Per-product image-gen mount in **edit form** (step 1 only
      today)
- [ ] R2 orphan sweep job (Model Studio leaves orphan prefixes on
      regenerate)
- [ ] `markupPercent` migration from `etsy_oauth` → `shop_settings`
- [ ] `shop_settings` table proper (per-product NULL-means-inherit)
- [ ] Server-action integration tests with test DB

### 🔌 External / asset blockers

- [ ] `BRAND_VOICE_PROMPT` env value (user-supplied) — affects
      enrichment tone

---

## Locked design rules (carry-forward)

- **Spanish-only admin.** Translations run at the Etsy-publish
  boundary. No EN UI anywhere. Memory:
  `feedback_translate-at-publish-boundary`.
- **All code in English.** Identifiers, URL params, registry keys.
  Spanish lives only in `messages.es.ts`. Memory:
  `feedback_code-english-only`.
- **Worker can't load `server-only` modules.** Sanctioned exceptions
  in `docs/project-conventions.md` §1.
- **R2 keys carry the `{run_id}` segment** for Model Studio. Cropper
  uploads to the same prefix as the sheet.
- **Regenerate UX**: always a `kickedAt` local state so UI flips to
  skeleton/loading before polling round-trip.
- **Component pattern mandatory** for non-trivial components — see
  `.agents/skills/project-conventions/component-pattern.md`.

---

## Maintenance norm

Update this file when:
- Mid-task scope changes.
- A session ends with non-trivial state to carry forward.
- A task moves from `in_progress` to `completed`.

When everything's between tasks, this file can be a one-liner.
**Don't let it bloat** — `roadmap.md` is the historical record;
this is the bookmark.
