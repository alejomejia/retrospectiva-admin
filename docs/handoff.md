# Session handoff

Transient state — "where we are right now, what's the immediate next
move." Updated by Claude sessions as work progresses.

The other docs (`roadmap.md`, `architecture.md`, etc.) are the stable
historical record. **This file is the bookmark.**

---

## Current state

**Phase 4 (Etsy integration) is `in_progress` — no code written yet.**

The previous session marked it in_progress and asked three scope
questions, then the session ended before answers arrived. The user
explicitly said they'd resume later.

**Last completed work:** Phase 3 is fully shipped (101/101 tests
green). The R2 layout is date-partitioned, the media uploader is
merged, video limits are 30 s / 100 MB, `Cache-Control` headers are
set on uploads.

## Three pending scope questions for Phase 4

Before writing any Etsy code, re-ask the user these via
`AskUserQuestion`. Don't assume answers from any prior context —
these were never received.

### Q1 · Etsy developer app status

> Do you have an Etsy developer app registered with `ETSY_CLIENT_ID`
> and `ETSY_CLIENT_SECRET`?

Options:
- **Not yet** → first deliverable of 4a is `docs/etsy-developer-app.md`
  walking through the registration (developer account, app scopes,
  redirect URI configuration).
- **Already registered** → skip the walkthrough; wire OAuth against
  the existing credentials.
- **Have seller account but not developer app** → effectively the
  same as "not yet"; still need the developer app registration.

### Q2 · Phase 4 scope (sub-phase to tackle next)

Phase 4 naturally splits into three coherent sub-chunks:

| Sub-phase | What ships | Size |
| --- | --- | --- |
| **4a · Connection** | OAuth + PKCE flow, `/settings/etsy` page to connect, callback handler, token storage in `etsy_oauth`, auto-refresh client wrapper, "Connected to {shop}" status. | ~1 day |
| **4b · Shop config** | Fetch shop's shipping profiles + return policies + shop sections. Settings UI to pick defaults. Curated taxonomy list. | ~1 day |
| **4c · Publish flow** | `listing-mapper.ts`, `publish.ts` orchestrator, image upload, video upload, ES translation, state→active. "Publicar en Etsy" button. | ~3–5 days |

Recommend **4a alone first** as the next deliverable — proves the
OAuth integration before building on it.

### Q3 · Publish-gap with Phase 6 (AI)

Etsy requires title / description / tags / `when_made` / materials.
Our product model only has `name` and `priceCents`. The three options
for 4c:

- **(Recommended)** Defer 4c until after Phase 6 (AI) — build 4a + 4b
  now; jump to Phase 6 next so we have real descriptions; then come
  back to 4c.
- Add manual entry fields now (description `<textarea>`, era picker,
  tags input) — superseded by AI in Phase 6.
- Hardcode placeholders for 4c — not actually shippable to the wife.

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

> Continue Phase 4. Read `docs/handoff.md` and re-ask the three scope
> questions there before writing any code.

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
