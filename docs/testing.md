# Testing

How tests are structured, what's tested vs deferred, and the small
number of project-specific quirks the test harness has to work
around.

## The stack

| Tool | Purpose |
| --- | --- |
| Vitest 4 | Unit + integration tests. Uses `jsdom` env by default, with a `// @vitest-environment node` pragma to opt-out per file. |
| `@testing-library/react` + `jest-dom` matchers | RTL for component tests (jsdom). |
| `@testing-library/user-event` | High-fidelity user interactions in component tests. |
| `msw` | HTTP-level mocks for external services (OpenAI, Etsy, website webhook). |
| `@playwright/test` | E2E. Lives in `e2e/`. Configured but no specs yet — deferred to Phase 4+ pass. |

## File layout

```
src/
  lib/auth/password.test.ts            ← unit
  lib/auth/session.test.ts             ← unit, `@vitest-environment node`
  lib/auth/users.test.ts               ← unit
  lib/auth/rate-limit.test.ts          ← unit
  lib/integrations/r2/keys.test.ts     ← unit (pure key helpers)
  lib/integrations/r2/upload.test.ts   ← unit, mocked S3Client
  lib/integrations/r2/delete-prefix.test.ts ← unit, mocked S3Client
  lib/products/schema.test.ts          ← zod schema
  lib/utils/helpers.test.ts            ← cn / toCSSVars
  lib/utils/money.test.ts              ← currency math + regex
  components/ui/button.test.tsx        ← RTL smoke
src/test/
  setup.ts                             ← jest-dom + MSW
  msw-server.ts                        ← MSW node server
  msw-handlers.ts                      ← default HTTP handlers
  server-only-shim.ts                  ← see "Quirks" below
e2e/                                   ← Playwright (empty for now)
vitest.config.ts
playwright.config.ts
```

## Run commands

```sh
pnpm test            # vitest run (all tests once)
pnpm test:watch      # vitest watch mode
pnpm test:e2e        # playwright test (needs the app running, see below)
pnpm test:e2e:install # one-time: install playwright browsers
```

## Vitest config

Three things in `vitest.config.ts` worth understanding:

### 1. Path alias + server-only shim

```ts
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
    // `server-only` throws when imported outside the react-server
    // bundler condition. Vitest doesn't set that condition, so we
    // alias to an empty shim — equivalent to the empty module Next.js
    // resolves on the server bundle.
    "server-only": path.resolve(__dirname, "./src/test/server-only-shim.ts"),
  },
},
```

`server-only` is the marker package we use in `config.ts`,
`session.ts`, `users.ts`, etc. to prevent client-side imports. It
throws by default when not loaded under React Server Components'
bundler condition. Vitest doesn't set that condition, so the throw
fires during tests — the alias replaces it with `export {};`.

### 2. Single environment, with per-file overrides

```ts
test: {
  environment: "jsdom",
  // ...
}
```

jsdom is the default. Pure-lib tests work fine in jsdom (jsdom is a
DOM polyfill, not a constraint on Node APIs). The exception:

`src/lib/auth/session.test.ts` has at the top:

```ts
// @vitest-environment node
```

Why: `jose`'s `FlattenedSign` constructor checks
`payload instanceof Uint8Array`. jsdom polyfills `TextEncoder` with
its own `Uint8Array` from a different JS realm, so the instanceof
check fails. Forcing this one file to `node` env keeps jose happy.

### 3. Test-env defaults

```ts
test: {
  // …
  env: {
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    REDIS_URL: "redis://localhost:6379",
    SESSION_SECRET: "test-session-secret-padded-to-32-chars-yes",
    ALLOW_USERS: "test:JDJiJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1Bx",
    OPENAI_API_KEY: "sk-test",
    // ... every other env var the config schema requires
  },
}
```

These satisfy the zod schema in `config.ts` so any module that
imports `config` (db client, integrations, auth helpers, etc.)
loads cleanly under Vitest. The values are syntactically valid but
non-functional (the bcrypt hash is a real-shape placeholder, not a
real password).

Without this block, `config.ts` would throw at module load because
zod's required-field validators would fail.

## MSW

`src/test/msw-server.ts` starts an MSW node server before all tests,
resets handlers between each, closes on shutdown. Default handlers in
`msw-handlers.ts` cover:

- `POST https://api.openai.com/v1/responses` → stub success
- `POST https://api.openai.com/v1/images/generations` → stub success
- `https://openapi.etsy.com/v3/*` → stub `{ ok: true }`
- `POST https://retrospectiva.example/api/revalidate` → stub success

Tests can layer additional / overriding handlers via `server.use(...)`.

## What's tested

| Area | Coverage |
| --- | --- |
| `auth/password` | bcrypt roundtrip, wrong password, malformed hash, salt uniqueness |
| `auth/session` | sign/verify, tampered (mid-char flip), wrong secret, expired, garbage |
| `auth/users` | base64 + bcrypt format validation, whitespace tolerance, duplicates, dotenv-mangled hash detection |
| `auth/rate-limit` | window math, per-key isolation, reset |
| `r2/keys` | path layout, role partition, video poster pairing, date prefix (incl. Madrid DST edge), public URL slash handling |
| `r2/upload` | PutObjectCommand params, error propagation, mocked S3 |
| `r2/delete-prefix` | refuses non-`/`-terminated prefixes, single-page sweep, continuation tokens, defense-in-depth on stray keys |
| `products/schema` | zod validation messages reference `m.validation.*` (tested via the message constants, not literal strings) |
| `utils/money` | formatCents, regex, cents conversion, round-trip |
| `utils/helpers` | `cn` + `toCSSVars` |

Total: ~99 tests, all green on a clean run.

## What's NOT tested (deferred)

- **Server-action integration tests** that hit the DB — would need a
  test Postgres (testcontainers or compose service for Vitest). The
  zod validation layer is covered by `schema.test.ts`; the DB path
  is exercised in development and will be covered by Playwright E2E.
- **Component RTL tests** beyond the button smoke. Most product UI
  is straightforward server-rendered markup; the few client
  components (MediaUploader, ProductEditForm, LoginForm) have
  enough internal logic to deserve tests when we do an E2E pass.
- **The full login + create + publish + sale flow** via Playwright.
  Comes with Phase 4 / Phase 7 — once Etsy is integrated, the E2E
  flow can be mocked end-to-end via MSW.
- **proxy.ts** runtime behavior. The matcher regex would benefit
  from coverage; deferred until we have a Playwright suite where it
  can be exercised holistically.

## Tips for adding new tests

- **Co-locate.** `foo.ts` → `foo.test.ts` in the same folder.
  Playwright in `e2e/`.
- **Pure logic first.** Anything you can extract into a function
  that doesn't touch IO is much easier to test than the same logic
  embedded in an action.
- **Reference message constants, not string literals.** When
  asserting on user-facing errors, write
  `expect(r.error).toBe(m.errors.invalidCredentials)` rather than the
  Spanish string. Future EN-fallback survives.
- **Mock at the SDK boundary, not the network.** R2 helpers take an
  optional `client` arg specifically so tests pass a mocked
  `S3Client`. Same shape for new integrations.
- **`mockReturnValueOnce` + `vi.fn()`** for sequenced multi-call
  mocks (see `delete-prefix.test.ts` for the paginated case).

## Playwright (config exists, specs deferred)

`playwright.config.ts` is set up but `e2e/` has no specs yet. The
expected pattern when we add them (Phase 4+):

```sh
# Start the test stack
docker compose up -d postgres redis
pnpm db:migrate
pnpm dev &                    # or pnpm build && pnpm start

# Run the suite
pnpm test:e2e
```

Playwright does **not** start its own webServer in `playwright.config.ts`
— deliberate, so the same command works in CI (where the workflow
orchestrates) and locally (where you have a dev server running
anyway).

Tests will mock OpenAI, Etsy, and the website webhook via MSW. R2
will use a real test bucket (or a local minio container) — TBD when
we get there.

## CI (not configured yet)

No CI yet — `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
on push is the manual workflow.

When CI happens (probably alongside Phase 9), it'd run all four
commands plus `pnpm test:e2e` against the compose stack. Caching
strategy: `~/.local/share/pnpm/store` (fast).
