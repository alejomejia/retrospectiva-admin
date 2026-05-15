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
| 4 — Etsy integration (OAuth + publish) | ⏳ Pending | OAuth 2.0 PKCE, listing-mapper, publish flow, translation flow for ES. |
| 5 — BullMQ background jobs | ⏳ Pending | `ai-enrich`, `etsy-publish`, `etsy-sync-sold`, `website-revalidate`, `r2-cleanup` (manual only). |
| 6 — OpenAI AI enrichment | ⏳ Pending | Brand-voice description, era estimation from photos, gpt-image-2 model placement. Single call emits EN + ES. |
| 7 — Webhooks (in/out, HMAC) | ⏳ Pending | Outbound to `retrospectiva-website` (bilingual payload), inbound Etsy receipts (poll-based, optional push). |
| 8 — Dashboard | ⏳ Pending | Date-range picker, revenue/sales KPIs, listings-by-status, activity feed, Tremor sales chart. |
| 9 — QoL extras | ⏳ Pending | Audit log, CSV import, product duplicator, pending-sync badge, Telegram notifier, image manager, cost tracker, keyboard shortcuts, orphan-draft cleanup. |

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

- **Admin: Spanish-only.** No locale toggle. The wife is Spanish-
  only; the husband is bilingual but reads Spanish fine. One locale
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
| Richer product fields (era, condition, size, fabric, story, measurements) | Phase 4 (Etsy field-mapped) |
| Pose library + model base image for AI try-on | Phase 6 |
| Brand voice text for AI description | Phase 6 (the user-supplied prompt) |
| Etsy app registration + initial OAuth connect | Phase 4 (one-time, done from the running app) |
| Orphan draft cleanup (sweep "Sin título" drafts > 7 days with no media) | Phase 9 |
| Audit log UI on the dashboard | Phase 8 (reads from the existing `events` table) |
| Bulk CSV import | Phase 9 |
| Telegram notifier on sale | Phase 9 |
| Per-row keyboard shortcuts on products list | Phase 9 |
| E2E Playwright spec for login + create + publish + sale flow | Phase 4 / 7 |
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
