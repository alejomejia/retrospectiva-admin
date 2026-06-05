# Deployment

How the admin is meant to run on the VPS, and the workflow for
shipping a new version.

## The four-service shape

`docker-compose.yml` defines four services from one repo:

```
┌──────────────────────┐    ┌──────────────────────┐
│  app                 │    │  worker              │
│  - Next.js server    │    │  - tsx src/lib/      │
│  - port 3000         │    │    queue/worker.ts   │
│  - same image        │    │  - same image        │
└──────┬───────────────┘    └──────┬───────────────┘
       │                           │
       └────────────┬──────────────┘
                    │ DATABASE_URL=postgres://retrospectiva:…@postgres:5432/…
                    │ REDIS_URL=redis://redis:6379
                    ▼
       ┌───────────────────────────┐
       │  postgres  (data volume)  │
       └───────────────────────────┘
       ┌───────────────────────────┐
       │  redis     (data volume)  │
       └───────────────────────────┘
```

`app` and `worker` build from the **same** `Dockerfile` — just
different `CMD`s in compose (`pnpm start` vs `pnpm worker:prod`).

The multi-stage `Dockerfile` uses Node 22 alpine and four stages:

| Stage | Job |
| --- | --- |
| `base` | Enable corepack so pnpm works. |
| `deps` | `pnpm install --frozen-lockfile` from the cached store. |
| `builder` | `pnpm build` (writes `.next`). A no-op `DATABASE_URL` is set during build so the db client module loads — runtime gets the real URL from the environment. |
| `runner` | Copies the built artifacts. `CMD ["pnpm", "start"]` for the app; compose overrides to `pnpm worker:prod` for the worker. |

## Required environment variables (production)

A complete `.env.production` (or compose `env_file`) needs **all** of
these. Missing any required one → zod schema in `config.ts` throws at
boot.

```
# Auth
ALLOW_USERS=alejandro:JDJiJDEyJDV…,pia:JDJiJDEyJDdD…
SESSION_SECRET=<openssl rand -base64 48>

# Database — note: hostname is `postgres` (compose service name), not localhost
DATABASE_URL=postgres://retrospectiva:retrospectiva@postgres:5432/retrospectiva
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=sk-…
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-2

# Etsy (Phase 4)
ETSY_CLIENT_ID=…
ETSY_CLIENT_SECRET=…
ETSY_REDIRECT_URI=https://admin.retrospectiva.example/api/etsy/oauth/callback
ETSY_SHOP_ID=…              # populated after the OAuth connect

# Cloudflare R2
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=retrospectiva
R2_PUBLIC_BASE_URL=https://cdn.retrospectiva.example   # custom domain on bucket

# Website webhook (Phase 7)
WEBSITE_WEBHOOK_URL=https://retrospectiva.example/api/revalidate
WEBSITE_WEBHOOK_SECRET=<shared with retrospectiva-website>

# Optional
TELEGRAM_BOT_TOKEN=…
TELEGRAM_CHAT_ID=…
```

See `.env.example` for the up-to-date list with comments.

## The hostname-by-context gotcha

**`DATABASE_URL` and `REDIS_URL` use service names (`postgres`,
`redis`) in production**, because the `app` and `worker` services run
inside the compose network where service names resolve.

**In local dev** (`pnpm dev` on the host while postgres is in a
container), they have to use `localhost`:

```
DATABASE_URL=postgres://retrospectiva:retrospectiva@localhost:5432/retrospectiva
```

This trip-up bit us during setup; see
[database-setup.md](../setup/database.md) for the full diagnostic
list.

## TLS / reverse proxy

The compose stack itself doesn't terminate TLS. Production assumes
a reverse proxy (Caddy / Nginx / Traefik) sits in front of port 3000,
handling HTTPS + `X-Forwarded-For`.

`signIn`'s rate-limit key reads `x-forwarded-for` then `x-real-ip` —
the proxy needs to set those for per-IP throttling to work
correctly. Without them, all requests share the `"unknown"` bucket.

## Deploy workflow

For a new version (manual, no CI yet):

```sh
# 1. On the dev machine: confirm everything green
pnpm typecheck && pnpm lint && pnpm test && pnpm build

# 2. Push to git
git push origin main

# 3. On the VPS
git pull
docker compose build app worker          # rebuild both images
docker compose up -d postgres redis      # ensure infra is up

# 4. Apply pending migrations (BEFORE bringing up app)
docker compose run --rm app pnpm db:migrate

# 5. Bring up the new app + worker
docker compose up -d app worker

# 6. Verify
docker compose ps                        # all healthy
curl https://admin.retrospectiva.example/api/health   # {"ok":true,"ts":"…"}
```

Migrations apply **before** the app boots so the schema is ready
when the new code starts. The `app` container doesn't run migrations
itself — the explicit `docker compose run` step makes it visible in
deploy logs.

## Production hardening checklist

- [ ] `SESSION_SECRET` is unique to production, ≥32 bytes from
  `openssl rand -base64 48`.
- [ ] `ALLOW_USERS` hashes were generated on this machine (or via the
  `pnpm hash-password` script with `BCRYPT_ROUNDS=12`).
- [ ] R2 bucket has a public custom domain bound, R2_PUBLIC_BASE_URL
  points at it.
- [ ] `R2_BUCKET` matches the actual bucket name.
- [ ] Reverse proxy passes `X-Forwarded-For` (or `X-Real-IP`) so
  rate-limit keys aren't bucketed under `"unknown"`.
- [ ] Reverse proxy terminates TLS; HSTS at minimum.
- [ ] Postgres data volume is backed up (regular `pg_dump` to off-VPS
  storage).
- [ ] Telegram notifier (Phase 9) configured if you want sale alerts.

## Backups

For a 2-user shop, manual weekly `pg_dump` to durable off-VPS storage
is enough. Suggested cron on the VPS:

```sh
0 3 * * 0 docker compose exec -T postgres pg_dump -U retrospectiva retrospectiva | gzip > /backups/retrospectiva-$(date +\%Y-\%m-\%d).sql.gz
```

R2 has its own durability (11 nines) so the bucket doesn't need a
separate backup; the DB is the irreplaceable part.

## Quick recovery scenarios

### "I broke a migration in production"

```sh
docker compose logs app | tail -50           # find the error
docker compose down app worker               # take the app offline
# Manually fix the schema in psql, OR restore from the last pg_dump
docker compose run --rm app pnpm db:migrate  # apply any remaining migrations
docker compose up -d app worker
```

For local dev, the equivalent of "nuke and restart" is:

```sh
docker compose down -v                       # ⚠ deletes the data volume!
docker compose up -d postgres redis
pnpm db:migrate
```

**Never run `down -v` against production.** No `-v` ever, with real data.

### "The app can't reach Postgres"

```sh
docker compose ps                            # check postgres health
docker compose logs postgres
docker compose exec postgres pg_isready -U retrospectiva
```

Check `DATABASE_URL` host part — production should say `postgres`,
not `localhost`.

### "Disk is filling up"

R2 stores all the media; the VPS should only host the DB + Redis.
Check:

```sh
du -sh /var/lib/docker
docker system df
docker system prune                          # safe — removes dangling stuff
```

The Postgres volume grows with product count + events log. For a
2-user shop this stays small for years.

## Logs

`docker compose logs -f app worker` for live tail. `[dev:auth]`,
`[dev:images]`, `[dev:videos]` prefixes mean dev-only diagnostic logs
(see [project-conventions.md](../overview/project-conventions.md) §3); in
production those branches dead-code-eliminate to no-ops and never run.

Server-side errors propagate to:
- Console (server logs) — via the `next.js` runtime
- The `events` table — Phase 5's worker writes job start/end and
  failures here for the activity feed

## Future hardening (Phase 9-ish)

- CI: run typecheck + lint + test on push, build the Docker image.
- Healthcheck endpoint for the worker (right now only the app has
  `/api/health`).
- Automated database backups + retention.
- Sentry or similar for production error tracking.

None of these are blocking; for a 2-user MVP, manual `docker compose`
+ weekly `pg_dump` is enough.
