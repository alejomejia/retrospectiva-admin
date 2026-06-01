# TODO

Pending work, grouped by area. Live bookmark is `docs/handoff.md`;
historical record is `docs/roadmap.md`. This file is the actionable
checklist.

---

## 🔥 Active — Phase 7 inbound (sale loop)

Outbound webhook to `retrospectiva-website` is done. Missing is the
receipt-polling side that closes the loop when an Etsy listing sells.

### Etsy receipts polling
- [ ] `src/lib/integrations/etsy/receipts.ts` — `getShopReceipts`
      client + parser
- [ ] Cron / interval job (every ~5 min) that pages new receipts
      since the last cursor
- [ ] Persist cursor (`etsy_oauth.lastReceiptCursor` or similar)
- [ ] Sale handler: match receipt line items to local
      `products.etsyListingId`, flip `status='archived'`, emit
      `events` row
- [ ] Telegram notifier hook point (Phase 9 picks this up)

### Optional push webhook receiver
- [ ] `/api/etsy/webhooks/receipts` route (HMAC-verified) — safety
      net if Etsy's webhook beta opens for the shop. Polling stays
      primary.

### Republish-on-edit UI verification
- [ ] Confirm "Sincronizar con Etsy" button is mounted in the edit
      form and enqueues `etsyUpdateQueue`. Queue + worker already
      exist; just verify the UI side.

---

## ⏳ Phase 4c — final polish

- [ ] E2E Playwright spec in `e2e/`: login → create → publish → sale
      (sale step depends on Phase 7 inbound)

---

## ⏳ Phase 8 — Dashboard

Root `(admin)/page.tsx` still the Phase 2 minimal landing.

- [ ] Date-range picker (global filter)
- [ ] KPIs: revenue & sales, listings-by-status, recent activity feed
- [ ] Tremor `<AreaChart>` sparkline + main chart
- [ ] Cost view reading `ai_runs.cost_usd`

---

## ⏳ Phase 9 — QoL drip

- [ ] Audit log UI (reads existing `events` table)
- [ ] Bulk CSV import
- [ ] Product duplicator
- [ ] Pending-sync badge
- [ ] Telegram notifier on sale (consumes Phase 7 inbound)
- [ ] Image manager
- [ ] Cost tracker UI
- [ ] Keyboard shortcuts on /products
- [ ] Bulk operations (multi-select archive/schedule/etc.)
- [ ] Column-header sorting on /products
- [ ] Orphan draft cleanup (sweep "Sin título" drafts > 7 days
      with no media)

---

## 🧹 Deferred follow-ups (tracked, not blocking)

- [ ] Per-product image-gen mount in **edit form** (step 1 only
      today) — Task 11 component already built reusable
- [ ] R2 orphan sweep job (Model Studio leaves orphan prefixes on
      regenerate)
- [ ] `markupPercent` migration from `etsy_oauth` → `shop_settings`
- [ ] `shop_settings` table proper (per-product NULL-means-inherit
      from shop defaults)
- [ ] Server-action integration tests with test DB

---

## 🔌 External / asset blockers

- [ ] `BRAND_VOICE_PROMPT` env value (user-supplied) — affects
      enrichment tone

---

## ✅ Recently shipped (since 2026-05-19)

- **Phase 4c Etsy publish processor (real)** — full
  `createDraftListing → upload media → inline runTranslation →
  state="active"` flow. Etsy app approved; OAuth + first publish
  smoke confirmed.
- **Etsy update flow** — `etsyUpdateQueue`, `update.ts`,
  `update-worker.ts`.
- **Phase 7 outbound webhook** — bilingual payload to
  `retrospectiva-website` with HMAC.
- **Task 11 per-product on-model image gen** — prompts, worker,
  queue, server actions, polling route, step-1 UI.
- **`/settings/ai`** shop-wide defaults page (was a deferred
  follow-up).
- **`/settings/products`**, **`/settings/integrations`** pages.
- 16 new migrations (0005 → 0020) — Etsy colors, sizes, shipping
  weight class, featured rank, etc.

---

## 📐 Locked design rules (carry-forward — don't violate)

- Spanish-only admin. Translation runs **inline at Etsy publish
  boundary**, never on autosave or enrich.
  (`feedback_translate-at-publish-boundary`)
- All code in English. Spanish lives only in `messages.es.ts`.
  (`feedback_code-english-only`)
- Worker can't load `server-only` modules. Sanctioned exceptions in
  `docs/project-conventions.md` §1.
- R2 keys carry `{run_id}` segment for Model Studio. Cropper uploads
  under same prefix.
- Regenerate UX: always `kickedAt` local state → UI flips to skeleton
  before polling round-trip.
- shadcn/ui first for any UI primitive; custom only with
  `DESIGN_SYSTEM.md` §6 entry.
- Component pattern mandatory for non-trivial components — see
  `.agents/skills/project-conventions/component-pattern.md`.
