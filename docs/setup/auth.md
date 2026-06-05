# Auth

A two-user admin gate. No registration, no password reset, no OAuth.
The credentials live in env; sessions are HS256 JWTs in HttpOnly
cookies; the proxy enforces both.

## The model in one sentence

> A small, hand-rolled username + bcrypt-password system, with the
> bcrypt hashes (base64-wrapped) sitting in the `ALLOW_USERS` env var
> and a sliding 7-day cookie session signed by `SESSION_SECRET`.

## Why hand-rolled (not Auth.js / NextAuth)

For a **2-user, single-locale** admin with no plans to add OAuth, OTP,
or self-serve registration, Auth.js is heavier than what's needed and
adds an extra surface to learn / maintain. The full system is ~300
lines across `src/lib/auth/`.

## File layout

```
src/lib/auth/
  password.ts          ← bcrypt hash + verify (no server-only marker)
  users.ts             ← parse ALLOW_USERS, findUser (server-only)
  session.ts           ← jose JWT sign/verify + cookie helpers (server-only)
  require-session.ts   ← server helper used inside server components
  rate-limit.ts        ← in-memory token bucket
src/proxy.ts           ← Next 16 route gate
src/app/(auth)/login/
  page.tsx             ← <Suspense> wrapper
  login-form.tsx       ← client component, useActionState + toast
  actions.ts           ← signIn server action
src/app/api/auth/logout/route.ts
scripts/hash-password.ts ← `pnpm hash-password "your password"`
```

## The `ALLOW_USERS` shape

```
ALLOW_USERS=alejandro:JDJiJDEyJDVxSXJwQTZRb...,pia:JDJiJDEyJDdDeUkz...
```

Comma-separated `username:base64-encoded-bcrypt-hash` pairs. The
parser tolerates whitespace around entries.

### Why base64-wrap the bcrypt hash

**Bcrypt hashes contain `$` characters** (`$2b$12$...`). **Next.js's
dotenv loader interpolates `$VAR` references** even when the value
is quoted. Without the wrap:

```
ALLOW_USERS=alejandro:$2b$12$5qIrpA6Qnw...
```

→ `@next/env` walks the value looking for `$VAR` patterns. `$2b`,
`$12`, etc. get expanded (usually to empty), and what reaches the
parser is something like `alejandro:5qIrpA6Qnw...` — a truncated
"hash" that bcrypt's compare returns false on, producing a confusing
"Invalid credentials" UX for the correct password.

Base64-encoding the hash removes all `$` characters. The env value
contains only `A-Z`, `a-z`, `0-9`, `+`, `/`, `=` — none of which
dotenv interpolates. The `users.ts` parser base64-decodes back to the
real bcrypt hash before calling `bcrypt.compare`.

### Bcrypt format validation

After base64 decoding, the parser checks the result against:

```
/^\$2[abxy]\$\d{2}\$[./0-9A-Za-z]{53}$/
```

This is the canonical bcrypt shape (60 chars total). If the decoded
value doesn't match — e.g. someone pasted a partial hash, or
something got mangled by an earlier pre-wrap copy/paste — the parser
throws at boot with a clear "malformed bcrypt hash" error. That's the
fast-fail surface; a silent "wrong password" at login is the failure
mode we're avoiding.

### Generating a hash

```sh
pnpm hash-password "your password"
```

The script:

1. Reads the password from arg or stdin (echo hidden if interactive).
2. Calls `hashPassword()` from `src/lib/auth/password.ts` (bcrypt cost
   **12**).
3. Base64-encodes the result.
4. Writes the encoded value to **stdout** so it can be piped.
5. Writes a ready-to-paste hint to **stderr**:

   ```
   Paste into .env.local. No quoting or escaping needed — the hash
   is base64-encoded so dotenv won't try to interpolate it:

     ALLOW_USERS=username:JDJi...
   ```

## Session

| Concern | Choice |
| --- | --- |
| Algorithm | HS256, secret = `SESSION_SECRET` (≥32 chars) |
| Library | `jose` (Web Crypto, works under edge if we ever go there) |
| Cookie name | `rsv_session` |
| Cookie flags | HttpOnly, `Secure` (in production), `SameSite=Lax`, `Path=/`, `Max-Age=7d` |
| Expiry policy | **Sliding 7 days** — `proxy.ts` re-mints the JWT on every authenticated request, so daily users never bounce mid-task |
| Payload | `{ sub: username, iat, exp }` |

### Verification flow

1. `proxy.ts` reads `rsv_session` cookie on every matched request.
2. Calls `verifySession(token)` — `jwtVerify` from jose.
3. Missing / expired / tampered → 302 redirect to `/login?next=…`.
4. Valid → re-mint with fresh expiry, attach to response, continue.

`require-session()` in `src/lib/auth/require-session.ts` is a server
helper for inside server components — same verify path, redirects on
failure. Defense-in-depth after proxy.

## The login flow

```
GET /login                            (always public)
  ↓ user types creds, submits form
  ↓ <form action={signIn}> → useActionState
signIn server action
  ├─ zod parse (username 1-64, password 1-256)
  ├─ rate-limit check on `${ip}|${username}` (5 attempts / 15 min)
  ├─ findUser(username)
  │   ├─ not found → dummy bcrypt.compare (timing-constant) → return { error: "Credenciales no válidas." }
  │   └─ found → verifyPassword(input, user.passwordHash)
  │       └─ no match → return { error: "Credenciales no válidas." }
  ├─ resetRate, sign session, setSessionCookie
  └─ redirect(next || "/")
useActionState hands the error to a useEffect → toast.error(...)
```

`useEffect` watches `state` (not `state.error`) so the same error
message fires a toast on consecutive failed attempts. Successful
submits `redirect()` and the form unmounts before the effect runs.

## Misconfiguration handling

`users.ts` originally parsed `ALLOW_USERS` at module load. If the env
was bad, the throw would crash every action that imported the module
— which produced Next.js runtime error pages, not friendly toasts.

The current code uses **lazy + cached** parsing:

- First call to `findUser()` parses, caches result.
- If parse fails, caches the error.
- Subsequent calls re-throw the cached error.

`signIn` wraps the `findUser` call in `try/catch`. On a parser throw,
it logs the full message via `devError("findUser threw…")` and
returns `{ error: m.errors.authMisconfigured(detail) }` — which the
form surfaces as a toast like:

> Authentication is misconfigured: ALLOW_USERS hash for "alejandro"
> did not decode to a bcrypt hash...

The misconfig prefix is Spanish; the dev-facing detail stays English
(server log, only seen by admins).

## Rate limiting

`src/lib/auth/rate-limit.ts` — in-memory map keyed by `${ip}|${username}`.

- **Window**: 15 minutes
- **Cap**: 5 attempts
- **Reset**: cleared on successful login OR when window expires
- **Soft**: returns `{ allowed: false, retryAfterSec }`; signIn
  surfaces `m.errors.tooManyAttempts(retryAfterSec)` as a toast

In-memory is correct for a 2-user, single-container deployment. If we
ever scale horizontally, swap the Map for a Redis sorted-set without
changing call sites — the public API (`checkRate`, `resetRate`,
`__resetAllRateLimitBuckets`) is already shaped for that.

## Logout

`POST /api/auth/logout` — clears the cookie, 303-redirects to
`/login`. 303 ensures the browser follows with GET. The topbar's
"Cerrar sesión" button is a `<form action="/api/auth/logout"
method="post">`.

## Proxy matcher

```ts
matcher: [
  "/((?!login|api/auth|api/webhooks|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|avif)).*)",
]
```

Everything EXCEPT the listed paths is gated. Webhooks are excluded
because they authenticate with HMAC, not session.

## Tests

- `password.test.ts` — hash/verify roundtrip, wrong password, malformed
  hash, salt-uniqueness.
- `session.test.ts` — sign/verify roundtrip, tampered (mid-char flip,
  base64url padding-bit safe), wrong secret, expired, garbage. **Forced
  to `node` env** via `// @vitest-environment node` to avoid jsdom's
  cross-realm `Uint8Array` breaking jose's instanceof check.
- `users.test.ts` — base64+bcrypt parsing, whitespace tolerance, empty
  entries, duplicate users, malformed hash detection (catches the
  dotenv-mangled case at boot).
- `rate-limit.test.ts` — window math, per-key isolation, reset.

## Quick troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Credenciales no válidas" with the *correct* password | `ALLOW_USERS` was pasted unwrapped — bcrypt's `$` chars got eaten by dotenv | Re-run `pnpm hash-password`, paste the base64 output. The parser now catches this at boot with a clearer error. |
| "Authentication is misconfigured" toast | `ALLOW_USERS` shape is wrong | The toast contains the parser detail; it'll say e.g. "did not decode to a bcrypt hash" or "expected user:base64-hash". |
| 401 / redirect loop on every request | `SESSION_SECRET` changed but cookie is still the old one | Open a private window or clear the cookie. |
| "Demasiados intentos" toast | Rate-limited — 5 failed attempts in 15 min | Wait it out, or restart the server to reset the in-memory bucket. |
