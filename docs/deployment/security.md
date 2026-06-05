# Security & anti-indexing

How the admin keeps bots, crawlers, and strangers out. Layered: app-level
guards live in this repo; network-level lockdown lives in front of the app and
is documented in [dokploy-deployment.md §11](./dokploy.md).

## Threat model

A two-user internal panel. Nothing here is meant for the public. Goals:

1. **Never indexed** by search engines or scraped by AI/LLM crawlers.
2. **No unauthenticated access** to any page or data route.
3. **Minimise public attack surface** — ideally the panel isn't reachable by
   strangers at all.

## App-level guards (in this repo)

### Auth gate — `src/proxy.ts`

Runs ahead of every request except a small allowlist (`login`, `api/auth`,
`api/webhooks` (HMAC-authed), `api/health`, `robots.txt`, static assets). No
valid session cookie → redirect to `/login`. Sliding 7-day HttpOnly JWT
session (`src/lib/auth/session.ts`): `HttpOnly`, `Secure` in production,
`SameSite=Lax`, HS256-signed with `SESSION_SECRET`.

### Login rate limiting — `src/lib/auth/rate-limit.ts`

5 failed attempts per (IP + username) in a 15-minute window locks that pair
out. Relies on the reverse proxy setting `X-Forwarded-For` (Traefik does this);
without it all clients share one bucket.

### No indexing / no AI scraping

- **`src/app/robots.ts`** → serves `robots.txt` that disallows `*` plus a list
  of named AI/LLM scrapers (GPTBot, ClaudeBot, CCBot, Google-Extended,
  PerplexityBot, Bytespider, …). `robots.txt` is whitelisted in `proxy.ts` so
  crawlers can actually read it without a session.
- **`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex`** on
  every response (header in `next.config.ts`) — covers non-HTML responses that
  a `<meta>` tag can't.
- **`robots: { index:false, follow:false }`** in the root layout metadata
  (`src/app/layout.tsx`) — emits the `<meta name="robots">` tag too.

> `robots.txt` and meta tags are **advisory** — they stop polite crawlers, not
> attackers or rogue scrapers. The auth gate and network lockdown are the real
> access control.

### Security response headers — `next.config.ts`

Applied to `/:path*`:

| Header | Value | Purpose |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Content-Security-Policy` | `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` | Clickjacking / injection |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `no-referrer` | Referrer leakage |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-origin isolation |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disable unused APIs |
| `X-DNS-Prefetch-Control` | `off` | Privacy |

The CSP is deliberately limited to directives that don't restrict scripts or
styles. A full `script-src` policy needs per-request nonces because Next.js
injects inline hydration scripts — see "Future hardening" below.

## Network-level lockdown (in front of the app)

The strongest layer. Pick one in
[dokploy-deployment.md §11](./dokploy.md):

- **Traefik IP allowlist** — only your known IPs reach the panel.
- **Cloudflare Access / Zero Trust** — identity gate at the edge; origin
  firewalled to Cloudflare IPs only. Best for roaming IPs.
- **Tailscale / WireGuard** — don't publish to the public internet at all.

Plus the VPS firewall baseline (deny inbound by default; never expose the
Dokploy dashboard `:3000` publicly).

## Production checklist

- [ ] `SESSION_SECRET` unique to prod, ≥32 bytes (`openssl rand -base64 48`).
- [ ] `ALLOW_USERS` hashes generated with `pnpm hash-password`.
- [ ] TLS terminated by Traefik/Cloudflare; HSTS active.
- [ ] One network-level gate from §11 is in place (IP allowlist / Access / VPN).
- [ ] VPS firewall denies inbound by default; `:3000` not public.
- [ ] Reverse proxy forwards `X-Forwarded-For` (rate-limit correctness).
- [ ] `robots.txt` returns the disallow rules (curl `/robots.txt`).
- [ ] Response headers present (`curl -I` the domain).

## Future hardening

- **Full CSP with nonces** — generate a per-request nonce, attach it to the CSP
  `script-src 'nonce-…'` and to Next's script tags. Closes XSS injection of
  inline scripts; needs request-time header generation (can't stay in the
  static `next.config.ts` headers array).
- **WAF** — Cloudflare's managed rules if the panel is proxied through it.
- **Audit log review** — the `events` table already records job activity;
  consider logging auth events (login success/failure) for review.
- **2FA** — if the threat model grows, add TOTP on top of password auth.

## Quick verification

```sh
# robots.txt blocks everyone
curl -s https://admin.retrospectiva.com/robots.txt

# security + noindex headers present
curl -sI https://admin.retrospectiva.com | grep -iE 'x-robots-tag|strict-transport|x-frame|content-security|x-content-type|referrer-policy'

# any page redirects to /login without a session (302 → /login)
curl -sI https://admin.retrospectiva.com/ | grep -i location
```
