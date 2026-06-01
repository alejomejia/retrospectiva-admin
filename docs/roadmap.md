# Roadmap + decisions log

What's been built, what's next, and the non-obvious decisions that
shaped each phase.

## Phase status

| Phase | Status | One-line summary |
| --- | --- | --- |
| 0 — Foundations | ✅ Done | Next 16 + React 19 + Tailwind v4 scaffold, Drizzle schema, Docker Compose, Vitest + Playwright + MSW, shadcn/ui scaffolded, `.npmrc` workaround for `minimum-release-age`. |
| 1 — Auth | ✅ Done | bcrypt + jose JWT cookie, sliding 7d, in-memory rate limit, `proxy.ts` gate, login + logout. |
| 2 — Product form (MVP) + edit | ✅ Done | Name + price form (RHF + zod), shared schema, server actions, edit-toggle on detail page. |
| 3 — Media (images + videos) on R2 | ✅ Done | Browser-side JPEG compression + HEIC decode, video upload with poster extraction, merged dropzone, date-partitioned R2 layout, `media-limits.ts` as the single source of truth for caps. |
| 4a — Etsy OAuth | ✅ Done | PKCE flow, settings page, shop lookup. Etsy app approved; smoke confirmed. |
| 4b — Etsy shop config | ✅ Done | Shipping profile + return policy defaults in `etsy_oauth`. |
| 4c — Etsy publish | ✅ Done (E2E spec pending) | Real `createDraftListing → upload images/video → inline runTranslation → state="active"` flow. Etsy update flow (`etsyUpdateQueue` + `update.ts` + `update-worker.ts`) also shipped. First publish smoke confirmed. Playwright E2E spec still TODO. |
| 5 — BullMQ infrastructure | ✅ Done | Worker boots, queues registered (`ai-enrich`, `etsy-publish`, `etsy-update`, `ai-model-generate`, `ai-image-placement`, `website-webhook`). |
| 6 — Product form rebuild + AI enrichment | ✅ Done | List view (filters/tabs/search/pagination/column selector), 2-step new-product stepper, flat edit form, OpenAI Responses API for all enriched fields incl. primary/secondary colors. Admin Spanish-only; `runTranslation` invoked inline by Phase 4c publish processor. See [product-form.md](./product-form.md) + [ai-enrichment.md](./ai-enrichment.md). |
| 6.5 — Model Studio | ✅ Done | Top-level `/models` admin section. Generates the shop's library of synthetic fashion models via the Phase 1 prompt + 7 select-driven variables; saves to R2 with `{run_id}` versioning. Lifecycle: draft → active → archived. See [model-generation/](./model-generation/README.md). |
| 7 — Webhooks (out) | ✅ Done | Outbound to `retrospectiva-website` with HMAC + bilingual payload (`website/payload-mapper.ts`, `sign.ts`, `webhook-worker.ts`). |
| 7 — Webhooks (in / sale loop) | ⏳ Pending | Etsy receipts polling (`getShopReceipts` every ~5 min) → sale handler flips `status='archived'`. Optional Etsy push receiver as safety net. |
| 8 — Dashboard | ⏳ Pending | Date-range picker, revenue/sales KPIs, listings-by-status, activity feed, Tremor sales chart, cost view on `ai_runs.cost_usd`. Root `(admin)/page.tsx` still the Phase 2 minimal landing. |
| 9 — QoL extras | ⏳ Pending | Audit log, CSV import, product duplicator, pending-sync badge, Telegram notifier, image manager, cost tracker, keyboard shortcuts, bulk ops, column sort, orphan-draft cleanup. |
| Task 11 — Per-product on-model image gen | ✅ Done (step-1 mount; edit-form mount deferred) | Prompts, worker, queue, server actions, polling route, step-1 UI. Schema added 6 `products.ai*` columns + `ai_reference` image role. |

## Decisions log (chronological)

Each entry: what we picked, what we considered, why we picked it.

### Stack / foundations (Phase 0)

- **Postgres + Drizzle, self-hosted on a VPS.** Alternative was
  Postgres-only (Etsy as source of truth, no local DB). Picked
  Drizzle because the dashboard, activity feed, draft state, and AI
  metadata all need persistence; Etsy-only would be too limited.
- **shadcn/ui new-york (radix) variant, NOT base-nova.** The
  base-nova variant tried to pull `@base-ui/react` which hit a pnpm
  registry quirk during init; new-york / radix is the battle-tested
  path.
- **Tremor Raw (copy-paste) NOT @tremor/react.** The npm package is
  still pinned to React 18 / Tailwind v3; copy-paste components work
  with React 19 + Tailwind v4.
- **`PNPM_CONFIG_MINIMUM_RELEASE_AGE=0` for installs in this project.**
  User's global pnpm config has `minimum-release-age=3600` (supply-
  chain freshness gate). Some packages (e.g. `vite` transitives) have
  metadata that trips it. Project `.npmrc` sets the override; CI /
  Docker need the env prefix.

### Auth (Phase 1)

- **Hand-rolled, not Auth.js / NextAuth.** 2 users, no registration,
  no OAuth — Auth.js is heavier than needed.
- **Sliding 7-day session.** Alternative was fixed 7d expiry. Sliding
  prevents daily users from being bounced mid-task.
- **`useActionState` for the login form** (not RHF). 2 fields,
  server-only validation, progressive-enhancement friendly.
- **Base64-wrap the bcrypt hash in `ALLOW_USERS`.** Bcrypt hashes
  contain `$`, which Next.js dotenv interpolates. Single-quote-
  wrapping doesn't help (dotenv strips quotes before expand). Earlier
  workaround was `\$` escaping — fragile. Base64-wrapping removes the
  problem entirely. See [auth.md](./auth.md).
- **Defer parser to first call.** Originally `users.ts` parsed at
  module load. A bad env crashed every server action that imported
  it with a runtime error page. Now lazy + cached; `signIn` wraps in
  try/catch and surfaces the error as a toast.
- **Rate limit: in-memory, 5/15min per IP+username.** In-memory is
  fine for 2 users + 1 container. The Map → Redis swap is a one-call
  refactor if we ever scale.

### Localization

- **Admin: Spanish-only.** No locale toggle. The main user is Spanish-
  only; the developer is bilingual but reads Spanish fine. One locale
  is simpler.
- **Etsy listings: EN primary, ES secondary.** Target market is EU
  buyers, not Spain-domestic; English maximises Etsy SEO. ES goes
  through `updateListingTranslation`.
- **Public website: bilingual EN + ES.** Visitor picks; webhook
  carries both.
- **One AI call → both locales.** Phase 6 prompt template will emit
  `{ en: …, es: … }` in a single Responses API call. Cheaper than two
  round-trips, and the EN/ES versions stay consistent.
- **Centralized `messages.es.ts`.** Alternative was hardcoded JSX
  strings. Centralized makes future EN-fallback mechanical, and keeps
  voice consistent.
- **Dev-facing errors stay English.** Parser throws, jose errors,
  R2 safety messages — they reach server logs (admins only) not the
  user. No reason to translate.
- **Price input dot-decimal (not comma).** Briefly tried Spanish-
  style comma; reverted. Matches Etsy's API (dot decimals) and keeps
  form/storage/integration consistent. The placeholder shows
  `49.99`, the validator accepts only `.`.

### Media handling (Phase 3)

- **JPEG output, not WebP.** Etsy's listing-image upload doesn't
  accept WebP. Storing JPEG directly avoids a decode + re-encode at
  publish. Storage delta (~2× WebP) is negligible at our scale.
  JPEG quality bumped to 0.85 to match WebP's perceptual quality on
  vintage fabric textures.
- **No server-side video transcoding.** FFmpeg.wasm is 25 MB,
  ffmpeg-static is a 50 MB native binary in Docker. For 2 users,
  short clips, and consistent iPhone source, not worth the complexity.
  Etsy accepts MP4 / MOV / WebM natively.
- **Browser-side compression for images, browser-side poster
  extraction for videos.** Wire payload, server CPU, and R2 storage
  all shrink at once. EXIF strip is a free privacy win.
- **Date-partitioned R2 keys** (`products/{YYYY}/{MM}/{DD}/{productId}/…`).
  Original was `products/{productId}/…` — unbrowsable in the R2
  console without knowing UUIDs upfront. Date partition is per-
  **product creation date**, formatted in `Europe/Madrid`, so all
  media for a product lives under one prefix forever even if photos
  are added weeks later.
- **No migration of historical R2 keys.** Each `r2Key` row stores
  the full key; old paths keep resolving. Only new uploads use the
  new layout. For our handful of test products, migration isn't
  worth doing.
- **Merged dropzone, separate galleries.** UX win to dispatch by
  MIME type so the user drops anything into one target. Galleries
  stay separate because their layouts diverge (grid vs vertical list
  with `<video controls>`).
- **Auto-create draft on `/products/new`.** Alternative was stashing
  files in browser memory until "Save" creates the product. Drafts
  are a legitimate status; orphan drafts can be swept later. Lets us
  reuse the edit/detail UI for create.
- **30 s / 100 MB video limits.** Started at 10 s / 50 MB matching
  Etsy's recommended length (5-15 s sweet spot). Bumped to 30 s for
  more breathing room on fabric drape / movement shots — Etsy still
  accepts up to 60 s. Size jumped to 100 MB at the same time
  (matches Etsy's hard cap) so 1080p/60 and 4K/30 at 30 s fit
  comfortably. Client-side pre-check catches oversize/over-length
  files before bytes hit the wire.
- **Limits centralized in `media-limits.ts`.** Single edit propagates
  to action validation, client pre-check, hint text, and error
  messages. Only `next.config.ts`'s framework caps need a manual
  bump.

### Etsy publishing (Phase 4 — planned)

- **Primary language: English.** ES via `updateListingTranslation`.
- **Publish state via `state="active"`**, not direct on create.
  Drafts stay drafts in Etsy until we explicitly activate.
- **Polling for sales**, not webhook. Etsy's webhooks beta isn't
  always available; `getShopReceipts` polled every 5 min is the
  reliable path. If the beta opens later, the inbound endpoint
  exists and the polling job becomes a safety net.

### Sale handling (Phase 5 / 7 — planned)

- **Don't delete R2 assets on sale.** Originally the plan was to
  sweep `r2-cleanup` automatically when a product sold. Changed to
  preserve assets indefinitely — they're useful for history, social
  proof, and re-listings of similar pieces. Manual hard-delete via
  the per-image trash still exists. `r2-cleanup` queue stays for
  admin-initiated sweeps.
- **Sold → `status='archived'`** (not `sold`). The `sold` enum
  value is kept in the schema for forward compatibility but isn't
  set by any current flow. Archived products are filtered out of the
  public website via `WHERE status = 'published'`.
- **`product_videos` is a separate table** (not a single
  `product_media` with a discriminator). Etsy's API already splits
  images and videos; aligning the DB to that split keeps the publish
  code clean.
- **`keepOnSale` column dropped from `product_images`.** With
  retention-on-sale, the per-image opt-out no longer applies.

### AI enrichment (Phase 6 — planned)

- **OpenAI end-to-end.** Single provider, single API key. gpt-5 for
  text + vision; gpt-image-2 for the model-placement image. User
  explicitly requested gpt-image-2 over gpt-image-1.
- **Brand voice prompt stored in `prompts.ts`** with env override
  `BRAND_VOICE_PROMPT`. Iteration on tone doesn't need a code change.
- **Model base image + pose library** to be supplied by the user
  later. Phase 6 ships with a placeholder so the integration is
  shaped correctly.

### Product form rebuild + AI (2026-05-17 round)

This round combines what the original roadmap split into Phase 6
(AI) and parts of Phase 4 (richer product fields needed for Etsy
publish). See [product-form.md](./product-form.md) +
[ai-enrichment.md](./ai-enrichment.md) for the full picture.

- **Tabs replace the status filter** on /products. Tabs:
  `activos | publicados | borradores | programados | archivados`.
  Default `activos` = drafts + published. The status filter from
  requirement 1a is dropped — one switcher, not two.
- **New `scheduled` status with auto-publish.** Adds the enum value,
  a `scheduled_publish_at timestamptz`, and a BullMQ delayed job in
  the `etsy-publish` queue that flips to `published` and pushes to
  Etsy at the chosen time (processor itself is Phase 4c).
- **URL search params for filter state.** `/products` is a server
  component reading `await searchParams`; filter/search/page state
  is shareable + refresh-safe. Column visibility/order is the only
  thing in `localStorage` (URL bloat for shareable links).
- **Page-based pagination, default 20**, sizes `[10, 20, 50]`.
- **Custom 2-step stepper for new product creation**: ① user inputs
  · ② AI review (per-field editable + regenerate). The publish
  sidebar (save draft / schedule / publish now) is the always-visible
  right rail, so there is no separate preview or publish step — step
  2 is already the final review surface. Flat edit form (no stepper)
  for existing products.
- **Per-field autosave, debounced 500 ms** writes to the DB row.
  No localStorage shadow state.
- **Store-flat measurements; double at the boundary** for
  chest/waist/hip/leg. Form shows both flat and circumference
  values; DB stores flat; Etsy/website payloads use doubled.
- **Bilingual: ES canonical, EN auto-derived.** Each text field has
  `*_es` + `*_en` columns. Tags + materials are parallel arrays
  aligned by index. Translation runs on a small `ai-translate`
  queue via `gpt-4o-mini` (cheap + fast).
- **Garment registry pattern.** Single `clothing-types.ts` is the
  source of truth for the 14 garment types, their categories, which
  measurements they require, and which of those double. Adding a
  new garment = one entry + a Postgres enum migration.
- **`products.name` dropped in favor of `title_es`**. One Spanish
  title shown everywhere in the admin and translated for Etsy. The
  title is never edited in step 1 — AI generates it in step 2 from
  the photo + the user-picked garment type, condition, etc.
- **Title capped at 140 characters** (Etsy's listing-title hard cap).
- **30 % Etsy markup as a shop-wide setting**, default 30, override
  per product via `markup_percent_override`. Computed Etsy list
  price is shown live next to the base-price input.
- **AI failures never block publishing.** Step 2 always renders;
  the main user can fill every field by hand if the OpenAI call fails.
- **Hard-delete prior AI-image on regenerate.** Only one
  `role='ai_model'` row + one R2 object per product survives.
- **Tabs/search/filter state lives in URL search params**; column
  visibility in `localStorage` only.
- **Curated Etsy taxonomy short list** in `taxonomy.ts` — drafted
  by Claude, reviewed by the user. AI picks from that closed set
  rather than the full Etsy taxonomy tree.

### Model Studio shipped + hardening (2026-05-19)

**Task 8 shipped**: `/models` admin section, generation form,
`gpt-image-2` worker, gutter-detect cropping with graceful fallback,
R2 storage (contact sheet + 6 cropped panels), `ai_models` table
with `draft → active → archived` lifecycle. See
[model-generation/model-studio.md](./model-generation/model-studio.md).

Decisions and fixes layered on top, post-Task-8:

- **Crop algorithm rewrite (2026-05-19).** Column-projection gutter
  detection retired — too fragile for narrow standing-pose figures
  inside white-on-white panels (every column outside the figure
  silhouette looked like a gutter). Replaced with: horizontal middle
  detected by projection (works thanks to portrait panels anchoring
  it), columns split into equal thirds of the image width, validated
  by a "split lines fall in mostly-white columns" sanity check.
  Empirically passes on `gpt-image-2` output that previously failed.

- **R2 keys carry the `{run_id}` segment.** `assets/models/{id}/{run_id}/...`
  instead of `assets/models/{id}/...`. Each regeneration writes to
  a fresh path so the 1-year-immutable cache headers don't bite us
  when keys are overwritten. Old prefixes become orphans (cheap;
  cleanup deferred). Discard still wipes via prefix delete.

- **Regenerar UX**: `kickedAt` local state in `ModelDetailView`
  (mirrors the `step-2-ai-review.tsx` pattern). Flips to skeleton
  the instant the user clicks, before the server round-trip lands a
  new run in the polling endpoint. Pattern is the project default
  for any regenerate flow.

- **Retry-crop button**: `retryCropModel(id)` action downloads the
  existing sheet from R2, re-runs `cropPanelsFromSheet` against the
  current algorithm. Useful for old `cropsAvailable=false` rows
  after algorithm tweaks. Button shows only when
  `model.contactSheetKey && !model.cropsAvailable`.

- **Prompt tightening (Phase 1 base)**: added explicit "figures
  occupy full vertical height" + "40px gutters on all sides"
  language to `BASE_MODEL_GENERATION`. Empirically improved gutter
  cleanliness in `gpt-image-2` output.

- **Cost estimator fix**: image models are flat-rate per call, not
  token-based. New `estimateImageCostUsd({ model, size, quality })`
  in `responses-helpers.ts`; the old token-based fallback was off
  by ~10× for `gpt-image-2`. Backfilled 7 existing
  `model_generation` rows so `ai_runs.cost_usd` matches the OpenAI
  dashboard. Token-based `estimateCostUsd` stays for text models.

### Idempotent enrich + auto-taxonomy (2026-05-18)

- **`enqueueEnrichJob` is now idempotent** when the latest enrich
  run is `succeeded`. Pass `{ force: true }` to bypass (used by
  Regenerar). Stops step 1 → step 2 navigation from re-running
  enrichment every time + losing manual tweaks.
- **Regenerar button on `AiContentSection`** (shared between step
  2 + edit form). Step 2 uses the unified `kick` pattern (retry +
  regenerate go through the same handler with `force: true`); edit
  form has on-click polling + `window.confirm` warning.
- **Etsy taxonomy auto-derived from `clothing_type`**. Picker
  removed from step 2 / summary. `clothing-types.ts` registry
  gained an `etsyTaxonomyKey` per garment; `updateProductDraftField`
  derives `etsyTaxonomyId` server-side. AI schema dropped
  `etsyTaxonomyKey` (one less field).
- **`runEnrichment` bumps `products.updatedAt`** so the
  `AiContentSection` key remounts after regenerate.

### Scheduled-publish queueing (2026-05-18)

- **BullMQ delayed-set is the schedule store.** `scheduleProduct`
  enqueues a delayed `etsy-publish` job with `delay = target - now`
  and `jobId = productId`. Redis persistence covers server restarts,
  and queue-scoped jobIds keep dedup simple. Re-scheduling uses the
  same remove-then-add pattern as `enqueueEnrichJob`.
- **Cancel-while-active race is handled in the worker, not the
  action.** If the user clicks "Cancelar programación" exactly when
  BullMQ flips the job from delayed to active, `queue.remove(jobId)`
  throws "job is active" (we swallow it). The worker then runs,
  re-reads the row, sees `status='draft'`, and self-cancels via a
  race-safety check before any DB write. Sub-second window; the
  user's intent wins.
- **Stub processor lands now, real Etsy push waits for Phase 4c.**
  The Task 9 worker just flips `status='published'` locally so the
  scheduling timing is testable without OpenAI / Etsy traffic.
  Phase 4c replaces the stub wholesale with the real flow
  (createDraftListing → upload images + video → inline
  `runTranslation` per translatable field → `state="active"`).

### Translation at the publish boundary (2026-05-18)

- **Admin UI is Spanish-only; translation runs at the Etsy publish
  boundary, not on autosave.** The main user doesn't read English and
  can't validate EN output, so paying for translations on every
  keystroke (or on every enrich fan-out) burns tokens on content that
  may never be published. The Phase 4c publish processor calls
  `runTranslation(productId, field)` inline per translatable field
  right before pushing to Etsy.
- **`*_en` columns + `ai_runs.kind='translation'` survive** as the
  cache + audit trail of what was last sent to Etsy. The website
  webhook (Phase 7) reads them when the listing is republished.
- **Republish on edit is explicit, not automatic.** When the user
  edits an ES field on a published product, the listing is marked
  "dirty" and a manual "Sincronizar con Etsy" action triggers the
  re-translation + re-push. Auto-publish on every save would
  broadcast intermediate drafts to live buyers.
- **First implementation pass was reverted** (autosave fan-out + EN
  collapsibles + per-field polling badges) after we realized the
  shop owner never sees EN. The primitive (`runTranslation`,
  `responses-helpers`, the EN columns, the translation `ai_runs`
  kind) stayed; the surrounding pipeline got removed.

### Model Studio split (2026-05-18)

- **AI model creation is its own admin surface, not part of the
  product stepper.** Originally Phase 6 bundled "generate a model
  inline during product enrichment". Reframed: the shop's set of
  synthetic models is a curated, slow-changing library built ahead
  of time at `/models`. Per-product image generation later picks
  from that library (manual select per product, default
  `Aleatorio`). See [model-generation/model-studio.md](./model-generation/model-studio.md).
- **Per-product on-model image gen blocked until Model Studio
  ships.** The original gpt-image-2 placement task is rebuilt to
  consume `ai_models` rows from the Studio rather than generating
  base imagery inline. Tracked separately as task #11, blocked by
  task #8.
- **Translations now the next active task** (was queued behind
  image work). Cheap, fast, and unblocks the bilingual EN columns
  the website webhook will eventually carry.
- **Model-generation prompt structure follows ChatGPT's
  recommendation** (one model per call, 6-panel contact sheet,
  modular prompts per phase). Original recommendation preserved
  verbatim at [model-generation/source-notes.md](./model-generation/source-notes.md).
- **`ai_models` table is new, not a reuse of `product_images`.**
  Different lifecycle (curated library vs per-product media),
  different consumers (model dropdown vs gallery), different
  status vocabulary.

### Dashboard (Phase 8 — planned)

- **Date-range picker** as the global filter.
- **Three KPIs first**: revenue & sales, listings-by-status, recent
  activity feed.
- **Tremor `<AreaChart>`** for sparklines + the main sales chart.

### Cross-cutting

- **Drizzle migrations checked in.** `pnpm db:generate` produces SQL
  in `src/lib/db/migrations/`; we commit them. `db:push` is for early
  iteration only; never against prod.
- **`@next/env` in `drizzle.config.ts`** so drizzle-kit picks up
  `.env.local` (same precedence as the running app).
- **`server-only` shim in Vitest** (`src/test/server-only-shim.ts`).
  Without the alias, importing `config.ts` from a test would trigger
  server-only's "this can't be in a client bundle" error because
  Vitest doesn't set the `react-server` bundler condition.

## Open TODOs (things deferred, not lost)

| Item | Phase it lands in |
| --- | --- |
| Richer product fields (era, condition, size, fabric, story, measurements) | ✅ Covered by the product-form rebuild |
| Pose library + model base image for AI try-on | ✅ Reframed — the Model Studio (Phase 6.5) generates these in-app; the manual-upload path is no longer the plan. |
| Brand voice text for AI description | Asset blocker — `BRAND_VOICE_PROMPT` env |
| Etsy app registration + initial OAuth connect | ✅ Done (smoke test still pending Etsy approval) |
| Real publish processor for the `etsy-publish` queue | Phase 4c |
| Orphan draft cleanup (sweep "Sin título" drafts > 7 days with no media) | Phase 9 |
| Audit log UI on the dashboard | Phase 8 (reads from the existing `events` table) |
| Bulk CSV import | Phase 9 |
| Bulk operations on /products (multi-select archive/schedule/etc.) | Phase 9 |
| Column-header sorting on /products | Phase 9 |
| Telegram notifier on sale | Phase 9 |
| Per-row keyboard shortcuts on products list | Phase 9 |
| E2E Playwright spec for login + create + publish + sale flow | Phase 4c / 7 |
| Server-action integration tests (with test DB) | Sometime; not blocking |

## Quick "what to build next" cheat sheet

If you're picking up the project and don't know where to start:

1. **Make sure Phase 0–3 still pass:** `pnpm test`, `pnpm typecheck`,
   `pnpm lint`, `pnpm build`. They should be green on a fresh clone.
2. **Read [media-handling.md](./media-handling.md)** because it
   summarizes the most recent / non-obvious design.
3. **Phase 4 (Etsy)** is the next blocker — without it, products
   can be drafted + media-attached but not published. See
   [etsy-listing-payload.md](./etsy-listing-payload.md) for the field
   reference, then build:
   - `src/lib/integrations/etsy/{client,oauth,publish,listing-mapper}.ts`
   - `src/app/(admin)/settings/etsy/page.tsx` for the one-time OAuth
     connect
   - `src/app/api/etsy/oauth/callback/route.ts`
4. Phase 5 follows naturally — once `etsy-publish` is sync, the
   BullMQ wrapping moves it to background.
