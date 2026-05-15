<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. In particular:

- `middleware.ts` is **deprecated** — use `proxy.ts` instead (see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
- New helpers exist: `unauthorized()`, `forbidden()` (see `04-functions/unauthorized.md`).
<!-- END:nextjs-agent-rules -->

# Design system

Read `DESIGN_SYSTEM.md` before any UI work. Tokens live in `src/lib/styles/theme.css`; custom utility classes in `src/lib/styles/utilities.css`; both are pulled together by `src/lib/styles/globals.css`, which is the only stylesheet `app/layout.tsx` imports. DM Sans + DM Mono + Caveat are the only allowed font families. **All UI primitives come from shadcn/ui** (`pnpm dlx shadcn@latest add <name>`) — only build custom components when shadcn has no equivalent, and document the reason in `DESIGN_SYSTEM.md` §6.

# Stack (locked)

- Next.js 16.2 (App Router) · React 19 · Tailwind v4 · TypeScript strict
- Postgres + Drizzle ORM · Redis + BullMQ
- OpenAI end-to-end (Responses API + `gpt-image-2`)
- Cloudflare R2 for images (S3-compatible SDK)
- Etsy Open API v3 (OAuth 2.0)
- shadcn/ui (new-york / radix) + Tremor Raw (charts, copy-paste)
- Auth: env-stored bcrypt hashes (`ALLOW_USERS`) + `jose`-signed JWT cookie
- Self-hosted via Docker Compose on a VPS

# Folder rules (enforced)

```
src/app/         pages + route handlers
src/components/  ui (shadcn), forms, products, dashboard, layout
src/lib/         non-component code
  auth/          password, session, requireSession
  db/            client, schema, migrations
  queue/         redis, queues, worker
  integrations/  etsy, openai, r2, website
  hooks/         general React hooks
  styles/        css beyond globals.css
  utils/         small helpers (cn lives in utils/helpers.ts)
proxy.ts         route protection (Next 16 file)
```

# Tests

- Vitest + RTL (jsdom for `src/components/**` and `src/app/**`, node for the rest)
- Playwright in `e2e/`
- MSW intercepts external HTTP (OpenAI, Etsy, website webhook)
- Run with `pnpm test`, `pnpm test:e2e`

# Comments policy

- Exported functions in `src/lib/integrations/**` and `src/lib/utils/**` get JSDoc, matching the style of `src/lib/utils/helpers.ts`.
- Security-relevant lines (auth, HMAC, cookies) get `// NOTE:` callouts.
- Avoid inline comments inside components unless behavior would surprise the reader.