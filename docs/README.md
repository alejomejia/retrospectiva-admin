# Retrospectiva Admin — Docs

Reference material for the admin panel. Each file is self-contained;
read whichever matches the question you've got.

## Where do I find...?

| Question | Document |
| --- | --- |
| **Where did the last session leave off? What's the immediate next move?** | **[handoff.md](./handoff.md)** ← start here when resuming |
| What is this app and how does it fit together? | [architecture.md](./architecture.md) |
| How is auth set up? What's that `ALLOW_USERS` env gotcha? | [auth.md](./auth.md) |
| How do I get Postgres running locally? | [database-setup.md](./database-setup.md) |
| How do I deploy to the VPS? | [deployment.md](./deployment.md) |
| What can we send to Etsy when we publish? | [etsy-listing-payload.md](./etsy-listing-payload.md) |
| How do I register the Etsy developer app + get the env vars? | [etsy-developer-app.md](./etsy-developer-app.md) |
| Why is the admin in Spanish but Etsy listings in English? | [localization.md](./localization.md) |
| How do image and video uploads work? What are the limits? | [media-handling.md](./media-handling.md) |
| What are the code conventions for this project? | [project-conventions.md](./project-conventions.md) |
| What's been built, what's next, what was decided? | [roadmap.md](./roadmap.md) |
| How are tests structured? Why does `session.test.ts` need `node`? | [testing.md](./testing.md) |

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
- See [project-conventions.md](./project-conventions.md) for code-level
  conventions (i18n, env, logging, file structure).
