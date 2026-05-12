# Consuming Environment Variables

App code never reads `process.env` directly. Always go through
`@/lib/utils/config` (or `@/lib/utils/public-config` for `NEXT_PUBLIC_*`
values used from client components).

## Why

- **One audit surface.** Every secret the app reads lives in one zod
  schema. `grep process.env src/` should turn up nothing — that's the
  signal there's no shadow config.
- **Fail-fast at boot.** The zod schema validates the whole env on the
  first import of `config.ts`. A missing or malformed variable crashes
  the process with a single readable error listing everything that's
  wrong. No "works until someone logs in then breaks" surprises.
- **Real types.** `config.databaseUrl` is `string`, not `string |
  undefined`. No `!` non-null assertions, no per-call defensive checks.
- **Client/server boundary.** `config.ts` has `import "server-only"`,
  so importing it from a client component fails the build. Secrets
  cannot accidentally end up in the client bundle.

## The pattern

```ts
// any server module
import { config } from "@/lib/utils/config";

const client = postgres(config.databaseUrl, { max: config.databasePoolMax });
```

For NEXT_PUBLIC_* values (rare for this app — most config is server-side):

```ts
// a client component
import { publicConfig } from "@/lib/utils/public-config";

<Image src={`${publicConfig.cdnBaseUrl}/logo.png`} alt="..." />
```

## Adding a new variable

1. Add the var to `.env.example` with a comment line above describing
   what it's for and (when relevant) how to obtain a value.
2. Add a zod entry to `Schema` in `src/lib/utils/config.ts`
   (`process.env.NEW_VAR_NAME` style).
3. Expose it as a camelCase field on the `config` object.
4. Add a sensible default to `vitest.config.ts`'s `test.env` block so
   `pnpm test` keeps running without a real env file.

## Sanctioned exceptions

These four files are allowed to read `process.env` directly. They run
either before or outside the app runtime, so routing them through
`config` would force the full app environment to be set just to do
their job. Each carries a comment explaining the exception.

| File | What it reads | Why |
| --- | --- | --- |
| `drizzle.config.ts` | `DATABASE_URL` | drizzle-kit CLI runs at `pnpm db:generate` / `db:migrate`; should work with just the DB URL. |
| `playwright.config.ts` | `CI`, `PLAYWRIGHT_BASE_URL` | Playwright CLI runs at `pnpm test:e2e`; doesn't need full app env. |
| `src/lib/utils/config.ts` | the whole env | This IS the parser. |
| `src/lib/utils/dev.ts` | `NODE_ENV` | Logger; needs to work in client + server. Next inlines this value as a build-time constant. |

Anything outside this list reading `process.env` is a bug — fix it by
adding the value to the config schema and importing `config`.

## Verification

```sh
# Should return ZERO results (apart from the canonical files above).
grep -rn "process\.env" src/ scripts/ --include='*.ts' --include='*.tsx' \
  | grep -v "src/lib/utils/config.ts" \
  | grep -v "src/lib/utils/dev.ts"
```
