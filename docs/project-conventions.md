# Project conventions

Code-level rules for working in this repo. These exist because each
one prevented or fixed a real bug.

The `.agents/skills/project-conventions/` folder has more detailed
write-ups for several of these (linked below); this file is the
human-readable summary.

## 1. Environment variables go through `config`

**Rule:** App code never reads `process.env` directly. Always go
through `@/lib/utils/config` (or `@/lib/utils/public-config` for
`NEXT_PUBLIC_*` values used from client components).

**Why:**

- `config.ts` zod-validates the whole env at boot — a missing var
  crashes startup with a single readable error listing everything
  wrong. No "works until someone logs in then breaks" surprises.
- `config.databaseUrl` is typed `string`, not `string | undefined`.
  No `!` non-null assertions, no per-call defensive checks.
- `config.ts` has `import "server-only"` — importing it from a client
  component fails the build. Secrets cannot accidentally end up in
  the client bundle.

**Sanctioned exceptions** (each carries a `// NOTE:` comment
explaining why):

| File | What it reads | Why |
| --- | --- | --- |
| `drizzle.config.ts` | `DATABASE_URL` | drizzle-kit CLI runs outside Next.js; `pnpm db:migrate` shouldn't require the full app env. |
| `playwright.config.ts` | `CI`, `PLAYWRIGHT_BASE_URL` | playwright CLI ditto. |
| `src/lib/utils/config.ts` | the whole env | This IS the parser. |
| `src/lib/utils/dev.ts` | `NODE_ENV` | Logger needs to work in both client and server; Next inlines this as a build-time constant. |
| `src/lib/db/client.ts` | `DATABASE_URL`, `DATABASE_POOL_MAX`, `NODE_ENV` | The BullMQ worker (`queue/worker.ts`) runs under raw `tsx` where `config`'s `server-only` chain throws. Reading env directly here lets the same `db` singleton work in both Next.js and worker contexts. |
| `src/lib/queue/redis.ts` | `REDIS_URL`, `NODE_ENV` | Same reason as `db/client.ts` — used from the worker. |
| `src/lib/queue/env-bootstrap.ts` | (calls `loadEnvConfig`) | Loads `.env.local` into `process.env` for the worker; mirrors the trick used in `drizzle.config.ts`. |

Anything outside this list reading `process.env` is a bug.

**Verifier:**

```sh
grep -rn "process\.env" src/ scripts/ --include='*.ts' --include='*.tsx' \
  | grep -v "src/lib/utils/config.ts" \
  | grep -v "src/lib/utils/dev.ts" \
  | grep -v "src/lib/db/client.ts" \
  | grep -v "src/lib/queue/redis.ts" \
  | grep -v "src/lib/queue/env-bootstrap.ts"
# should return zero lines
```

See `.agents/skills/project-conventions/consume-env-via-config.md`.

## 2. User-facing strings live in `messages.es.ts`

**Rule:** Any string a user might see goes through `m.*` from
`@/lib/i18n/messages.es`. Never hardcode Spanish strings in JSX,
toasts, action errors, or zod messages.

**Why:**

- One file is the source of truth for the UI's voice.
- Adding an EN fallback later is a mechanical change.
- `grep`-friendly: "do we say 'Eliminar' or 'Borrar' for delete?" —
  one search answers it.

**What stays English:** code comments, JSDoc, dev-facing errors
(thrown deep in libs, only seen in server logs), and the brand mark
"Retrospectiva Admin".

See [localization.md](./localization.md).

## 3. Dev-only logging via `@/lib/utils/dev`

**Rule:** Diagnostic logs go through `devLog`, `devWarn`, `devError`,
or `devGroup(tag)`. Never `console.log` directly in app code.

**Why:**

- Greppable — every line is prefixed with `[dev]` or `[dev:scope]`.
- Zero production overhead — Next inlines `NODE_ENV` and dead-code-
  eliminates the noop branches.
- Server-side detail without leaking to the client — e.g. `signIn`
  logs the *real* failure reason ("user not found" vs "password
  mismatch") server-side while the client sees the generic "Invalid
  credentials" toast.

**What NOT to log, even in dev:** plaintext passwords, full bcrypt
hashes, session tokens, raw PII. Treat dev logs as if a screenshot
might be shared.

**Verifier:**

```sh
grep -rn "console\.\(log\|warn\|error\)" src/ --include='*.ts' --include='*.tsx' \
  | grep -v "src/lib/utils/dev.ts" \
  | grep -v "\.test\."
```

See `.agents/skills/project-conventions/use-dev-logger.md`.

## 4. UI primitives come from shadcn first

**Rule:** Before hand-rolling any UI component, check if shadcn has
it. Run `pnpm dlx shadcn@latest add <name>` to scaffold; only build
custom when shadcn has no equivalent.

**Why:** shadcn's primitives are radix-backed (accessibility done
right), styled via our brand tokens (one less thing to design), and
the upgrade path is "re-run the CLI." Hand-rolled components inherit
none of that and tend to drift.

If you do build custom, document the reason in `DESIGN_SYSTEM.md` §6.

## 5. Design tokens, not hex literals

**Rule:** Use the brand utilities (`bg-brand-cream`, `text-brand-ink`,
`border-brand-olive`) or the shadcn semantic ones (`bg-background`,
`text-foreground`, `bg-primary`). Never hex literals inline.

**Why:** Tokens live in `src/lib/styles/theme.css` as Tailwind v4
`@theme` entries. Changing a color is one line; the design stays
consistent.

The semantic tokens (`bg-background`, etc.) are mapped to the same
hex as the brand utilities (`bg-brand-cream`, etc.). The distinction:

- **Semantic** for functional surfaces (button, card background) —
  carries meaning, would change in a hypothetical dark theme.
- **Brand** for decorative or always-fixed surfaces — palette
  swatches, status badges that always mean "sold".

Fonts: **DM Sans (body + display), DM Mono (caplet labels), Caveat
(script accent)**. No serif fonts. `Inter`, `Fraunces`, `Playfair`,
etc. are not in scope.

## 6. Form pattern: react-hook-form + zod + shadcn `Form`

**Rule:** Forms use `useForm` with `zodResolver(SchemaName)`, fields
via shadcn's `<Form>` / `<FormField>` / `<FormItem>` / `<FormControl>` /
`<FormMessage>`. The zod schema is **shared** between the client form
and the server action that consumes it (re-validation on the server).

Exception: the login form uses `useActionState` + plain JSX. Reason:
it's 2 fields, server-only validation, and progressive-enhancement
friendly. Not worth the RHF ceremony.

## 7. Comments policy

- **Exported functions** in `src/lib/integrations/**` and
  `src/lib/utils/**` get JSDoc. Match the style of
  `src/lib/utils/helpers.ts` (`cn`, `toCSSVars`).
- **Security-relevant lines** (auth, HMAC, cookies) get `// NOTE:`
  callouts. The point is to slow down a future reader at the load-
  bearing part of the code.
- **Inline comments inside components** are avoided unless behavior
  would surprise a reader (e.g. why a particular `useEffect` runs
  once, or why we're calling `e.target.value = ""` after picking a
  file).
- **What the code does** is the code's job. **Why** is the
  comment's job.

## 8. Tests live next to the code they cover

`foo.ts` → `foo.test.ts` in the same folder. E2E specs in `e2e/`.

What earns a test: pure logic (parsers, regex helpers, money math,
key generators), security-adjacent code (auth, HMAC, prefix sweepers).

What doesn't: server actions that hit the DB (no easy mock surface
in our setup), UI components without complex state. The Playwright
specs in Phase 8+ will cover end-to-end flows.

See [testing.md](./testing.md) for the Vitest / Playwright config.

## 9. File organization

```
src/app/                       pages + route handlers
src/components/
  ui/                          shadcn primitives
  forms/                       complex forms
  products/                    product-specific
  layout/                      sidebar / topbar
src/lib/
  auth/                        password / session / users / rate-limit
  db/                          drizzle client + schema + migrations
  i18n/                        messages.es.ts
  integrations/
    r2/                        S3-compat client + key helpers
    etsy/                      Phase 4
    openai/                    Phase 6
    website/                   Phase 7
  products/                    server actions + zod schemas + media-limits
  queue/                       Phase 5 (BullMQ)
  styles/                      Tailwind v4 theme + atmosphere
  utils/                       small helpers (cn lives in utils/helpers.ts)
src/proxy.ts                   Next 16 route gate
```

A new top-level concern (e.g. analytics, search) creates a new folder
under `src/lib/` rather than getting wedged into an existing one.

## 10. Next.js 16 specifics worth remembering

- **`proxy.ts`** replaces `middleware.ts`. Same role, renamed file
  convention.
- **`unauthorized()` and `forbidden()`** are first-class helpers from
  `next/navigation` (Next 16 additions).
- **Server Actions** can't export non-async values. Constants used by
  actions live in a separate (non-`"use server"`) file.
- **Body-size caps come in two flavors** — `serverActions.bodySizeLimit`
  AND `experimental.proxyClientMaxBodySize`. Both must be ≥ the
  largest legitimate upload. See [media-handling.md §Body-size caps].
- **`searchParams` is async** in App Router server components in Next
  16 — `const sp = await searchParams;`.
- **Read `node_modules/next/dist/docs/` before writing any code** —
  Next 16 has breaking changes vs older training data. AGENTS.md
  reminds about this at the top.

## 11. Collaboration norms (for Claude sessions specifically)

Three rules about how Claude sessions should approach work in this
repo. They're not "code rules" strictly, but they're load-bearing
for the project.

The canonical version lives in
[`.agents/skills/project-conventions/collaboration-norms.md`](../.agents/skills/project-conventions/collaboration-norms.md)
— auto-loaded when Claude reads project skills. The summary:

- **Rule 1: Don't add features the user didn't ask for.** Defensive
  code, dark themes, "future-proof" abstractions — propose first,
  don't ship-then-explain.
- **Rule 2: Ask first when there are options or doubts.** Use
  `AskUserQuestion` to surface the tradeoff; the user wants to make
  the call, not justify it after the fact.
- **Rule 3: Counter-propose when there's a better path.** The user
  has explicitly invited pushback when their initial idea isn't
  optimal for this stack. Evaluate, propose, then execute.

These have been refined by real decisions in this project (WebP →
JPEG, archived-on-sale, base64-wrap bcrypt, separate galleries +
merged uploader, etc.) — every one of those was a tradeoff worth
surfacing. The canonical doc has each incident written up.

## Quick verifier checklist before a PR

```sh
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm test          # vitest run
pnpm build         # full production build, regenerates Next types
```

All four green = ready to commit. The build catches issues
typecheck doesn't (stale `.next/types/validator.ts` after file
deletes, server-action "use server" violations, etc.).
