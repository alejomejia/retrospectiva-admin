# Architecture

How the admin is shaped, from top-level stack down to file layout.

## Runtime + framework

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js **16.2** (App Router) | App Router primitives (Server Components, Server Actions, route handlers). |
| Routing gate | `proxy.ts` (NOT `middleware.ts`) | Next 16 renamed the file. Old `middleware.ts` is deprecated. |
| Runtime | Node (default for proxy.ts in Next 16) | Lets us use `bcryptjs`, `jose`, `@aws-sdk/client-s3` without edge limitations. |
| Language | TypeScript strict | All `src/` is `.ts` / `.tsx`. |
| Frontend | React **19** + Tailwind v4 | Server Components by default, client components opt-in via `"use client"`. |
| Bundler | Turbopack (Next 16 default) | — |
| Form library | `react-hook-form` + `zodResolver` + shadcn `Form` | Single zod schema shared by client form + server-action re-validation. |

## Persistence

| Concern | Choice |
| --- | --- |
| Primary DB | Postgres 17 (alpine in compose) |
| ORM | Drizzle ORM + Drizzle Kit (migrations under `src/lib/db/migrations/`) |
| Client | `postgres-js` driver, ~10-connection pool, cached on `globalThis` to survive HMR |
| Migrations | Generated SQL files committed; applied with `pnpm db:migrate` |

## Storage

| Concern | Choice |
| --- | --- |
| Object store | Cloudflare R2 (S3-compatible) |
| SDK | `@aws-sdk/client-s3` with R2 endpoint |
| Public access | Custom domain bound to bucket, base URL in `R2_PUBLIC_BASE_URL` |
| Key layout | `products/{YYYY}/{MM}/{DD}/{productId}/{role}/{uuid}.{ext}` — see [media-handling.md](../ai/media-handling.md) |

## Background jobs (Phase 5)

| Concern | Choice |
| --- | --- |
| Queue | BullMQ on top of Redis |
| Worker | `pnpm worker` (`tsx src/lib/queue/worker.ts`), separate container in compose |
| Queues planned | `ai-enrich`, `etsy-publish`, `etsy-sync-sold`, `website-revalidate`, `r2-cleanup` (manual hard-delete only) |
| Idempotency | `jobs_idempotency` table — webhook/job purposes can dedupe on string keys |

## External integrations

| Integration | Lib | Purpose |
| --- | --- | --- |
| OpenAI | `openai` SDK | Brand-voice description, era estimation from photos, model-placement images (Phase 6). Single provider for text + vision + image generation. |
| Etsy | Hand-rolled fetch wrapper (Phase 4) | OAuth 2.0 PKCE, draft listing → upload images → upload video → translations → activate. |
| Cloudflare R2 | `@aws-sdk/client-s3` | Object storage. |
| Website webhook | HMAC-signed `fetch` to `WEBSITE_WEBHOOK_URL` (Phase 7) | Notifies the public `retrospectiva-website` repo on publish / sold. |

## Auth

| Concern | Choice |
| --- | --- |
| Identity | env-stored `ALLOW_USERS` (comma-separated `user:base64-bcrypt-hash` pairs) |
| Session | `jose`-signed HS256 JWT in HttpOnly cookie, sliding 7-day expiry |
| Rate limit | In-memory token bucket, 5 attempts / 15 min per IP+username |
| Gate | `proxy.ts` matcher excludes `/login`, `/api/auth/*`, `/api/webhooks/*`, `/api/health`, statics |

See [auth.md](../setup/auth.md) for the full picture, including the dotenv
interpolation gotcha that drove the base64-wrap choice.

## UI system

| Concern | Choice |
| --- | --- |
| Primitives | shadcn/ui (new-york / radix variant) — installed components live under `src/components/ui/` |
| Charts | Tremor (Tremor Raw, copy-paste) for Phase 8 dashboard |
| Icons | `lucide-react` (shadcn default) |
| Toasts | `sonner` — `<Toaster richColors position="top-right" />` mounted in `app/layout.tsx` |
| Fonts | DM Sans (body + display) · DM Mono (caplet labels) · Caveat (script accent). No serif fonts ever, per the design system. |
| Colors | Brand palette via Tailwind v4 `@theme`. Available as `bg-brand-cream`, `text-brand-ink`, etc., AND as shadcn semantic tokens (`bg-background`, `text-foreground`). See `src/lib/styles/theme.css`. |

## Localization

The admin is **Spanish-only** for the primary user. All user-
facing strings live in `src/lib/i18n/messages.es.ts`. See
[localization.md](../product/localization.md) for the full direction including
Etsy listing locales and AI translation flow.

## Folder layout

```
src/
  app/
    (auth)/login/              ← login screen + actions
    (admin)/                   ← protected (auth via proxy.ts + layout)
      layout.tsx               ← sidebar + topbar, calls requireSession()
      page.tsx                 ← dashboard (Phase 8 will flesh this out)
      products/
        page.tsx               ← list
        new/route.ts           ← GET → auto-create draft → 303 redirect
        [id]/page.tsx          ← edit + media + (Phase 4) publish
      settings/                ← Phase 4 lands here (Etsy connect)
    api/
      auth/logout/route.ts
      health/route.ts
      etsy/oauth/callback/     ← Phase 4
      webhooks/etsy/           ← Phase 7
    not-found.tsx
    global-error.tsx
  components/
    ui/                        ← shadcn primitives
    forms/                     ← MediaUploader, future product/etsy settings forms
    products/                  ← ProductDetailsCard, ProductEditForm, ImageList, VideoList
    layout/                    ← SidebarNav, Topbar
  lib/
    auth/                      ← password, session, users, rate-limit, require-session
    db/                        ← Drizzle client, schema, migrations
    i18n/                      ← messages.es.ts
    integrations/
      r2/                      ← S3 client + key helpers + upload + delete-prefix
      etsy/                    ← Phase 4
      openai/                  ← Phase 6
      website/                 ← Phase 7 (outbound webhook)
    products/                  ← server actions, schema, media-limits
    queue/                     ← Phase 5 (queues + worker)
    styles/                    ← Tailwind theme + atmosphere
    utils/                     ← config, dev, helpers, money, compress-image, extract-video-poster
  proxy.ts                     ← route gate (Next 16 name)
  test/                        ← MSW handlers + server-only shim + setup
```

## Deployment shape

`docker-compose.yml` defines four services:

- `app` — Next.js server (port 3000)
- `worker` — BullMQ worker, same image, different `command`
- `postgres` — Postgres 17 with healthcheck + persisted volume
- `redis` — Redis 7 with persisted volume

The same `Dockerfile` builds the app and the worker (multi-stage build,
shared base + deps + builder + runner stages).

See [deployment.md](../deployment/overview.md) for the production workflow.

## Things that aren't here yet

| Phase | Status | Doc |
| --- | --- | --- |
| 0 — Foundations | ✅ Done | [roadmap.md](./roadmap.md) |
| 1 — Auth | ✅ Done | [auth.md](../setup/auth.md) |
| 2 — Product form (MVP) | ✅ Done | — |
| 3 — Media on R2 | ✅ Done | [media-handling.md](../ai/media-handling.md) |
| 4 — Etsy integration | ⏳ Pending | [etsy-listing-payload.md](../etsy/listing-payload.md) |
| 5 — Background jobs | ⏳ Pending | — |
| 6 — AI enrichment | ⏳ Pending | — |
| 7 — Webhooks | ⏳ Pending | — |
| 8 — Dashboard | ⏳ Pending | — |
| 9 — QoL extras | ⏳ Pending | — |
