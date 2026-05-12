# Dev-Only Logging

For diagnostic logs that should help during development but disappear
in production, use `@/lib/utils/dev` — never raw `console.log`.

## Why

- **Zero production overhead.** The module reads
  `process.env.NODE_ENV === "development"` once, and Next.js inlines
  that as a build-time constant. In a production build every `devLog`
  / `devWarn` / `devError` resolves to a `noop` function, and the
  bundler eliminates the dead branches. Calls cost nothing.
- **Greppable.** Every line is prefixed with `[dev]` or `[dev:scope]`
  so you can grep `[dev:auth]` for auth-related output, etc.
- **Server- and client-safe.** No imports of `server-only` modules, so
  you can use it from anywhere — including proxy.ts and client
  components.
- **Avoids leaking debug detail to the client.** Use it on the server
  to explain WHY a request failed; the user still gets the generic
  error message, you still see the precise cause in the terminal.

## The pattern

```ts
import { devLog, devWarn, devError, devGroup } from "@/lib/utils/dev";

// One-offs:
devLog("ALLOW_USERS loaded:", listUsernames());
devWarn("rate-limited:", key, "for", seconds, "s");

// Subsystem-scoped (tag is repeated on every line):
const dev = devGroup("auth");
dev.warn("user not found:", username);
dev.warn("password mismatch for:", username);
dev.log("signed in:", username);
```

Output during `pnpm dev`:

```
[dev] ALLOW_USERS loaded: [ 'alejandro' ]
[dev:auth] user not found: ghost
```

## When to use it

Reach for `devGroup(...)` (or the bare functions) whenever you have:

- **Auth/security flow detail** the client must NOT see. E.g. "user
  not found" vs. "password mismatch" — the server logs the real
  reason, the client always sees "Invalid credentials."
- **Boot-time configuration confirmations.** "Loaded N users", "Etsy
  OAuth token expires in X minutes", "BullMQ worker connected".
- **Job/queue state changes** that are useful when something hangs.
- **Webhook receipts** with IDs, so you can correlate prod logs with
  upstream events.

## What NOT to log, even in dev

- Plaintext passwords (yes, even briefly).
- Full bcrypt hashes, session tokens, API secrets.
- PII you don't need (full customer email, shipping address).

Treat dev logs as if a screenshot might be shared. Log shapes and
identifiers, not sensitive payloads. If you really need to inspect
a secret value, do it via a debugger or a one-off REPL — never via a
committed `devLog` call.

## When NOT to use it

- For errors a user is going to act on: bubble them up through the
  normal mechanism (`toast.error`, server-action `state.error`,
  thrown `Error`). Dev logs are not user-facing.
- For metrics: those need persistence and aggregation; dev logs are
  noise-level. Phase 9's "audit log" + the `events` table are the
  durable channel.
- For "I wrote a console.log to debug this once" cases that you'd
  immediately delete. Just use `console.log` and delete it before
  commit. `devLog` is for diagnostic surfaces that we WANT to keep.

## Verification

```sh
# A bare `console.log` in app code is almost always a bug. Allowed
# exceptions: scripts/, tests, and the dev.ts file itself.
grep -rn "console\.\(log\|warn\|error\)" src/ --include='*.ts' --include='*.tsx' \
  | grep -v "src/lib/utils/dev.ts" \
  | grep -v "\.test\."
```
