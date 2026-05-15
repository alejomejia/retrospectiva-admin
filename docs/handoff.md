# Session handoff

Transient state — "where we are right now, what's the immediate next
move." Updated by Claude sessions as work progresses.

The other docs (`roadmap.md`, `architecture.md`, etc.) are the stable
historical record. **This file is the bookmark.**

---

## Current state

**Phases 4a, 4b, and 5 are all shipped.** 143/143 tests green,
typecheck clean, production build green, worker process boots +
handles SIGTERM cleanly under direct `tsx` invocation.

### Phase 5 additions (2026-05-15)

- `src/lib/queue/redis.ts` — BullMQ-compatible ioredis singleton
  (`maxRetriesPerRequest: null`, `enableReadyCheck: false`).
- `src/lib/queue/queue-options.ts` — `DEFAULT_JOB_OPTIONS` constant
  (3 attempts, exponential backoff, 24h success retention, 7d
  failure retention).
- `src/lib/queue/events-log.ts` — three helpers:
  - `logJobEvent({ jobId, type, productId?, payload? })` → inserts
    into the `events` table with `actor="worker"`; swallows DB
    failures so logging hiccups never crash a job.
  - `isJobProcessed(key)` → checks `jobs_idempotency`.
  - `markJobProcessed(key, purpose)` → inserts with `ON CONFLICT
    DO NOTHING`.
  - `countProcessedJobs(purpose)` — sanity-check helper.
- `src/lib/queue/env-bootstrap.ts` — side-effect-only module that
  calls `loadEnvConfig(process.cwd())`. Imported FIRST by
  `worker.ts` so env is populated before any env-reading import.
- `src/lib/queue/worker.ts` — process entrypoint. Imports
  env-bootstrap, then redis. Logs startup, sets a heartbeat
  interval to keep the loop alive until real workers register,
  handles SIGTERM/SIGINT for graceful shutdown.
- 6 new tests covering `logJobEvent` and idempotency helpers.

### Plumbing change worth knowing about

`src/lib/db/client.ts` and `src/lib/queue/redis.ts` now read
`process.env.DATABASE_URL` / `process.env.REDIS_URL` directly,
**not** via `config`. Reason: `config` transitively imports
`server-only`, which throws under raw `tsx` (no react-server
bundler condition). The worker needs both clients to work in
non-Next contexts. Client-bundle protection is preserved because
`postgres` and `ioredis` are Node-only deps that would fail to
bundle into a client build. See `docs/project-conventions.md`
§1 for the updated sanctioned-exceptions list.

### What's blocked on Phases that consume the queue

Phase 5 ships INFRASTRUCTURE only — no public queues declared yet.
The worker process logs "no workers registered yet" on startup.
Each downstream phase adds its own queue + processor by
side-effect-importing into `worker.ts`:

```ts
// in worker.ts main(), each phase adds its line:
await import("@/lib/integrations/etsy/publish-worker");   // Phase 4c
await import("@/lib/integrations/openai/enrich-worker");  // Phase 6
await import("@/lib/integrations/website/revalidate-worker"); // Phase 7
```

Until then the worker is a "ready and idle" daemon — useful for
verifying the Docker compose setup works on the VPS, not for
processing real jobs.

### Phase 4b additions (2026-05-15)

- Migration `0002_material_dracula.sql` adds two nullable columns
  to `etsy_oauth`: `default_shipping_profile_id`,
  `default_return_policy_id`. **Run `pnpm db:migrate` to apply.**
- `src/lib/integrations/etsy/shop-config.ts` — `listShippingProfiles`,
  `listReturnPolicies`, `listShopSections` helpers (each takes
  optional `TokenStore` for testability).
- `src/lib/integrations/etsy/defaults-actions.ts` — `saveEtsyDefaults`
  server action with zod coercion (numeric strings → numbers,
  empty → null).
- `src/components/forms/etsy-defaults-form.tsx` — client form with
  two shadcn `<Select>` pickers, `useTransition` pending state,
  sonner toast on success/error.
- `/settings/etsy` page extended with a "Valores por defecto" card.
  Card gracefully degrades to a "Valores no disponibles" message
  when Etsy API calls fail (which they will until approval).
- Spanish strings under `m.settings.etsy.defaults.*`.
- `listShopSections` is NOT exposed on the settings page — sections
  are per-listing and will be picked by AI in Phase 6.

**What's been built (2026-05-15):**

- `docs/etsy-developer-app.md` — developer-app registration walkthrough
- `src/lib/integrations/etsy/oauth.ts` — PKCE, authorize URL builder,
  token exchange, refresh rotation, `EtsyOAuthError`
- `src/lib/integrations/etsy/client.ts` — authenticated `etsyFetch`
  with auto-refresh via `getValidAccessToken`; pluggable `TokenStore`
- `src/lib/integrations/etsy/oauth-state.ts` — signed cookie carrying
  `{ state, codeVerifier }` across the Etsy bounce (HS256 with
  `SESSION_SECRET`, `aud=etsy-oauth`, 10-min TTL)
- `src/lib/integrations/etsy/shops.ts` — `parseUserIdFromAccessToken`
  + `fetchShopByOwnerUserId`
- `src/app/api/etsy/oauth/start/route.ts` — initiates the flow
- `src/app/api/etsy/oauth/callback/route.ts` — verifies state,
  exchanges code, fetches shop, upserts `etsy_oauth` (keyed by
  `shop_id`), redirects with success / error code
- `src/app/(admin)/settings/etsy/page.tsx` — three states:
  disconnected, connected (with shop name fetched from
  `/shops/{shop_id}`), error
- Spanish strings under `m.settings.etsy.*` (including a code →
  message map for callback errors)
- Tests: 27 new (oauth 10, client 8, oauth-state 4, shops 5)

**What's blocked on the user — and on Etsy:**

1. ✅ Developer app registered (2026-05-15).
2. ✅ `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET`, `ETSY_REDIRECT_URI`
   pasted into `.env.local`.
3. ⏸ **Waiting on Etsy approval.** The app's dashboard status is
   **"Pending Personal Approval"**. Attempting OAuth right now
   returns "The application that is requesting authorization to use
   your Etsy account is not recognized" — this is Etsy, not a code
   bug. We just have to wait (hours to a couple of days, per Etsy's
   process). User gets an email when approved.
4. ⏳ Once approved: visit `/settings/etsy`, click "Conectar con
   Etsy", verify the page renders "Conectado · Tienda: …" with the
   real shop name.

If the smoke test fails after approval, the most likely culprits
are: (a) shape mismatch on `/users/{userId}/shops` or
`/shops/{shopId}` JSON (the typed shapes in `shops.ts` and the
settings page might need a small adjustment), (b)
`redirect_uri_mismatch` — verify the URI registered in Etsy's
portal matches `ETSY_REDIRECT_URI` byte-for-byte.

**Previous shipped phase:** Phase 3 (101/101 tests green). R2 date-
partitioned, merged media uploader, video limits 30 s / 100 MB,
1-year immutable `Cache-Control` on uploads.

## Locked scope decisions (2026-05-15)

- **Q1 · Etsy app status:** Not yet → first deliverable of 4a is
  `docs/etsy-developer-app.md` walking through registration
  (developer account, scopes `listings_w listings_r transactions_r
  shops_r`, redirect URI).
- **Q2 · Sub-phase:** **4a only** this round (OAuth + connection).
  4b (shop config) and 4c (publish) are deferred.
- **Q3 · Publish-gap:** When we get to 4c, **use placeholder values**
  for required Etsy fields (title/description/tags/era/materials).
  Phase 6 (AI) will replace them with a "upload photo → AI fills the
  form → per-field regenerate" flow. User will give the field list +
  order + regenerate UX details before Phase 6 starts.

## Prerequisite state already in the repo (don't re-add)

- `etsy_oauth` table exists in `src/lib/db/schema.ts` (Phase 0, never
  populated yet)
- `config.etsyClientId`, `config.etsyClientSecret`,
  `config.etsyRedirectUri`, `config.etsyShopId` already in
  `src/lib/utils/config.ts`'s zod schema
- The 4a sub-phase shape outlined below uses these — no schema
  migration needed for 4a, 4b, or 4c.

## The 4a sub-phase shape (when confirmed)

- `src/lib/integrations/etsy/oauth.ts` — PKCE: build authorize URL,
  exchange code for tokens, rotate refresh tokens
- `src/lib/integrations/etsy/client.ts` — fetch wrapper with
  `Authorization: Bearer` + `x-api-key` headers and lazy token
  refresh (uses `expiresAt` from the row)
- `src/app/(admin)/settings/etsy/page.tsx` — "Conectar con Etsy" /
  "Conectado como: …" status
- `src/app/api/etsy/oauth/callback/route.ts` — receives `code` +
  verifies `state`, stores tokens in `etsy_oauth`
- First read-only smoke test: fetch `/users/me/shops` and display
  the shop name on the settings page
- New Spanish strings under `m.settings.etsy.*`

## Resume prompt

Paste into a new Claude Code session in this repo:

> Continue Phase 4a. Code is shipped; only the real-shop smoke test
> remains (gated on the user registering the Etsy developer app).
> Once the user confirms the round-trip works, move on to Phase 4b
> or jump to Phase 6 per their preference.

That's all the next session needs. AGENTS.md auto-loads. This file
is durable. The roadmap doc has the broader context if needed.

## Maintenance norm

Update this file when:
- Mid-phase scope changes (e.g. after answering one of the three
  questions, narrow it to the chosen path).
- A session is ending with non-trivial state to carry forward.
- A phase moves from `in_progress` to `completed` (clear the
  in-progress notes here; roadmap.md absorbs the history).

When everything's between phases and there's no live scope decision,
this file can be just a one-liner ("Phase 5 next. No pending
questions.") or even empty.
