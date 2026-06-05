# Retrospectiva Admin — Docs

Reference material for the admin panel. Docs are grouped by topic into
folders; each file is self-contained. New here? Read
**[overview/handoff.md](./overview/handoff.md)** first.

## Folder map

```
docs/
  overview/     what the app is, where it's going, how to work in it
  setup/        get it running locally (database, auth)
  deployment/   ship it to the VPS + harden it
  etsy/         Etsy Open API integration, listings, ads
  ai/           OpenAI enrichment, media, on-model image generation
  product/      product form UI + localization
  testing/      automated tests + manual smoke checklist
  policies/     customer-facing shop policies (returns, shipping)
```

## Overview — start here

| Question | Document |
| --- | --- |
| **Where did the last session leave off? What's the immediate next move?** | **[handoff.md](./overview/handoff.md)** ← start here when resuming |
| What is this app and how does it fit together? | [architecture.md](./overview/architecture.md) |
| What's been built, what's next, what was decided? | [roadmap.md](./overview/roadmap.md) |
| What are the code conventions for this project? | [project-conventions.md](./overview/project-conventions.md) |

## Setup — run it locally

| Question | Document |
| --- | --- |
| How do I get Postgres running locally? | [setup/database.md](./setup/database.md) |
| How is auth set up? What's that `ALLOW_USERS` env gotcha? | [setup/auth.md](./setup/auth.md) |

## Deployment — ship + harden

| Question | Document |
| --- | --- |
| How do I deploy to the VPS? | [deployment/overview.md](./deployment/overview.md) |
| How do I deploy via Dokploy? | [deployment/dokploy.md](./deployment/dokploy.md) |
| How is the app kept out of search indexes / hardened? | [deployment/security.md](./deployment/security.md) |

## Etsy — the sales channel

| Question | Document |
| --- | --- |
| How do I register the Etsy developer app + get the env vars? | [etsy/developer-app.md](./etsy/developer-app.md) |
| What can we send to Etsy when we publish? | [etsy/listing-payload.md](./etsy/listing-payload.md) |
| How should we run Etsy ads for the shop? | [etsy/advertising.md](./etsy/advertising.md) |

## AI — enrichment + image generation

| Question | Document |
| --- | --- |
| How does AI enrichment work (prompts, queues, gpt-image-2)? | [ai/enrichment.md](./ai/enrichment.md) |
| How do image and video uploads work? What are the limits? | [ai/media-handling.md](./ai/media-handling.md) |
| What's the plan for per-product on-model image generation (Task 11)? | [ai/per-product-image-gen.md](./ai/per-product-image-gen.md) |
| How are the AI model-generation prompts structured (phases 1-4)? | [ai/model-generation/](./ai/model-generation/README.md) |

## Product — UI + i18n

| Question | Document |
| --- | --- |
| How does the products list / new-product stepper / edit form work? | [product/form.md](./product/form.md) |
| Why is the admin in Spanish but Etsy listings in English? | [product/localization.md](./product/localization.md) |

## Testing — automated + manual

| Question | Document |
| --- | --- |
| How are tests structured? Why does `session.test.ts` need `node`? | [testing/overview.md](./testing/overview.md) |
| What should I manually verify before declaring Phase 6 shippable? | [testing/smoke-test.md](./testing/smoke-test.md) |

## Policies — customer-facing

| Question | Document |
| --- | --- |
| What's the returns policy? | [policies/returns-policy.md](./policies/returns-policy.md) |
| What's the shipping policy? | [policies/shipping-policy.md](./policies/shipping-policy.md) |

## The 30-second pitch

Retrospectiva is a vintage clothing shop. This repo is the **admin
panel** that the two owners use to:

1. Draft a product (name, price, photos, video).
2. Generate descriptions + an AI model placement with OpenAI.
3. Publish to Etsy as the single sales channel.
4. Receive a webhook back when the item sells, mark it archived, and
   ping a separate public website (`retrospectiva-website`, not this
   repo) to revalidate.

The public website is a **separate project**; this admin only talks to
it via signed HMAC webhooks.

## Stack at a glance

- Next.js 16.2 (App Router, `proxy.ts` not `middleware.ts`) · React 19
- Tailwind v4 + shadcn/ui (new-york / radix) + Tremor (Phase 8)
- TypeScript strict, DM Sans + DM Mono + Caveat
- Postgres + Drizzle ORM
- Cloudflare R2 (S3-compatible) for media
- Redis + BullMQ for background jobs (Phase 5)
- OpenAI for text + image generation (Phase 6)
- Etsy Open API v3 (OAuth 2.0) for publishing (Phase 4)
- Self-hosted on a VPS via Docker Compose

## Norms for working in this project

For future Claude sessions and human collaborators:

- **Read the relevant doc here before writing code.** Many decisions
  (WebP → JPEG, archived-on-sale, Spanish admin, date-partitioned R2,
  etc.) are non-obvious without context.
- **Propose before executing** non-trivial changes. Surface tradeoffs
  via questions before silently picking an approach.
- **Counter-propose when you see a better path** — the user has
  explicitly asked for pushback when their initial idea isn't the
  optimal one for this stack.
- **Don't add features that weren't requested.** Defensive code, dark
  modes, "future-proof" abstractions — all of these should be
  proposed, not silently added.
- See [project-conventions.md](./overview/project-conventions.md) for code-level
  conventions (i18n, env, logging, file structure).
