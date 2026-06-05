# Deploying to Dokploy

Step-by-step to run `retrospectiva-admin` on a [Dokploy](https://dokploy.com)
instance. Dokploy is a self-hosted PaaS on top of Docker Swarm + Traefik;
Traefik gives you automatic HTTPS (Let's Encrypt) and domain routing, so you
don't run your own Caddy/Nginx.

This repo already ships a four-service `docker-compose.yml`
(`app`, `worker`, `postgres`, `redis`) — see [deployment.md](./deployment.md)
for the architecture. The cleanest Dokploy mapping is the **Compose**
service type: Dokploy just runs a production compose file straight from git.
[Option B](#option-b--managed-databases--two-applications) covers the more
"Dokploy-native" split (managed DBs + two Apps) if you prefer it.

> The Dokploy UI changes between releases. Tab/button names below match the
> 2025 UI; if something moved, the concept (env tab, domain tab, compose file
> path) is still there.

---

## 0 · Prerequisites

- A VPS (≥ 2 GB RAM; image build + Postgres + Redis + app + worker) running a
  recent Ubuntu/Debian, with Docker installed (the Dokploy installer handles
  Docker if missing).
- DNS `A` records pointing at the VPS IP:
  - `admin.retrospectiva.com` → app
  - (R2 has its own CDN domain — not on the VPS.)
- Open ports `80`, `443` (Traefik) and `3000` (Dokploy dashboard) on the VPS
  firewall.
- Credentials ready: OpenAI key, Etsy app (client id/secret), Cloudflare R2
  keys + bucket + public base URL, website webhook URL + shared secret. See
  [`.env.example`](../.env.example).

---

## 1 · Install Dokploy on the VPS

SSH into the VPS as root and run:

```sh
curl -sSL https://dokploy.com/install.sh | sh
```

When it finishes, open `http://<VPS_IP>:3000`, create the admin account, and
(recommended) set a server domain for the panel + enable Let's Encrypt for it
under **Settings → Server**.

Add your **SSH/Git access** so Dokploy can clone this repo:

- Private repo → **Settings → Git** → add a GitHub/GitLab provider or a deploy
  SSH key, and add that key as a read-only deploy key on the repo.
- Public repo → nothing extra needed.

---

## 2 · Generate the secrets you'll paste later

Run these **on your dev machine** (the repo has the scripts) and keep the
output for step 4:

```sh
# Session signing key — 32+ bytes, base64
openssl rand -base64 48

# One bcrypt hash per admin user (base64-wrapped to survive dotenv)
pnpm hash-password '<your-password>'      # → alejandro:JDJiJDEy…
pnpm hash-password '<pia-password>'       # → pia:JDJiJDdD…
```

`ALLOW_USERS` is the two pairs joined by a comma:
`alejandro:JDJiJDEy…,pia:JDJiJDdD…`.

---

## 3 · Create the project + Compose service

1. Dokploy dashboard → **Create Project** → name it `retrospectiva`.
2. Inside it → **Create Service → Compose**.
3. **Provider → Git**: point at this repo, branch `dev` (or your release
   branch).
4. **Compose Path**: `docker-compose.dokploy.yml` (you'll add this file in the
   next step — or reuse `docker-compose.yml` and edit it; the production file
   keeps the Dokploy-specific bits out of the local-dev compose).

### 3a · Add a production compose file

The bundled `docker-compose.yml` publishes host ports (`5432`, `6379`, `3000`)
— fine for local dev, wrong for a shared VPS. For Dokploy, drop the host port
maps (Traefik routes internally) and attach the `app` to Dokploy's external
`dokploy-network` so Traefik can reach it. Commit this as
`docker-compose.dokploy.yml`:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: retrospectiva
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: retrospectiva
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U retrospectiva"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    env_file: .env
    environment:
      DATABASE_URL: postgres://retrospectiva:${POSTGRES_PASSWORD}@postgres:5432/retrospectiva
      REDIS_URL: redis://redis:6379
    networks:
      - default
      - dokploy-network
    labels:
      - traefik.enable=true
      - traefik.http.routers.retrospectiva-app.rule=Host(`admin.retrospectiva.com`)
      - traefik.http.routers.retrospectiva-app.entrypoints=websecure
      - traefik.http.routers.retrospectiva-app.tls.certresolver=letsencrypt
      - traefik.http.services.retrospectiva-app.loadbalancer.server.port=3000

  worker:
    build: .
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    env_file: .env
    environment:
      DATABASE_URL: postgres://retrospectiva:${POSTGRES_PASSWORD}@postgres:5432/retrospectiva
      REDIS_URL: redis://redis:6379
    command: ["pnpm", "worker:prod"]
    networks:
      - default

networks:
  dokploy-network:
    external: true

volumes:
  postgres_data:
  redis_data:
```

Notes:

- **No host `ports:`** — only Traefik (via labels) reaches the app. Postgres
  and Redis stay on the internal `default` network, never exposed.
- `DATABASE_URL`/`REDIS_URL` use the service names `postgres` / `redis` (the
  app runs inside the compose network) — the hostname gotcha from
  [deployment.md](./deployment.md) does not bite here.
- The Traefik router/service names (`retrospectiva-app`) must be unique across
  your whole Dokploy instance.
- Instead of hand-writing the labels you can leave them off and use the
  Dokploy **Domains** tab on the Compose service (Service: `app`, Port:
  `3000`, enable HTTPS/Let's Encrypt) — it injects equivalent labels. Pick one
  approach, not both.

> Don't want a new file? You can edit `docker-compose.yml` directly and set
> Compose Path to it — but then local `docker compose up` inherits the
> Traefik labels + external network, which won't exist on your laptop.

---

## 4 · Set environment variables

Open the Compose service → **Environment** tab. Dokploy writes this content to
`.env` at the repo root before building, which the compose `env_file: .env`
and `${POSTGRES_PASSWORD}` interpolation both read.

Paste **all required** vars (the app's zod schema in
`src/lib/utils/config.ts` fails to boot if any are missing):

```sh
# --- infra secret used by the compose file ---
POSTGRES_PASSWORD=<openssl rand -base64 24>

# --- auth ---
ALLOW_USERS=alejandro:JDJiJDEy…,pia:JDJiJDdD…
SESSION_SECRET=<openssl rand -base64 48>

# --- openai ---
OPENAI_API_KEY=sk-…
OPENAI_TEXT_MODEL=gpt-5
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_TRANSLATE_MODEL=gpt-4o-mini

# --- etsy ---
ETSY_CLIENT_ID=…
ETSY_CLIENT_SECRET=…
ETSY_REDIRECT_URI=https://admin.retrospectiva.com/api/etsy/oauth/callback

# --- cloudflare r2 ---
R2_ACCOUNT_ID=…
R2_ACCESS_KEY_ID=…
R2_SECRET_ACCESS_KEY=…
R2_BUCKET=retrospectiva
R2_PUBLIC_BASE_URL=https://cdn.retrospectiva.com

# --- website webhook ---
WEBSITE_WEBHOOK_URL=https://retrospectiva.com/api/revalidate
WEBSITE_WEBHOOK_SECRET=<shared with retrospectiva-website, ≥16 chars>
```

**Do not** set `DATABASE_URL` or `REDIS_URL` here — the compose file sets them
per-service to the internal hostnames. If you put them in `.env` too, the
compose `environment:` block still wins, but it's cleaner to omit them.

Optional (leave out to disable): `ETSY_SHOP_ID` (auto-filled after the OAuth
connect), `ETSY_WEBHOOK_SECRET`, `BRAND_VOICE_PROMPT`, `DATABASE_POOL_MAX`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

---

## 5 · Configure the domain

If you used the manual Traefik labels in 3a, the host
(`admin.retrospectiva.com`) and TLS are already declared — just make sure the
DNS `A` record resolves to the VPS so Let's Encrypt can issue.

If you skipped the labels, open the Compose service → **Domains** → **Add
Domain**:

- Host: `admin.retrospectiva.com`
- Service: `app`
- Container Port: `3000`
- HTTPS: on, Certificate: Let's Encrypt

---

## 6 · Deploy

Hit **Deploy** on the Compose service. Dokploy clones the repo, builds the
image (multi-stage Dockerfile, Node 22 alpine), and starts all four services.

Watch **Logs / Deployments**. First build is slow (pnpm install + `next
build`); later deploys reuse the layer cache.

---

## 7 · Run the database migration

The schema isn't applied automatically — the app expects migrations run
explicitly (see [database-setup.md](./database-setup.md)). After the first
successful deploy, exec into the running `app` container:

- Dokploy → Compose service → **Terminal** (or the container's shell), then:

```sh
pnpm db:migrate
```

Or from an SSH session on the VPS:

```sh
docker ps --filter name=app          # find the app container id
docker exec -it <app_container_id> pnpm db:migrate
```

Re-run this step after any deploy that adds a migration (`src/lib/db/migrations`).

---

## 8 · Verify

```sh
curl https://admin.retrospectiva.com/api/health
# {"ok":true,"ts":"…"}
```

Then in the dashboard confirm all four services are healthy, and check
worker logs are consuming jobs:

```sh
# Dokploy Logs tab, or on the VPS:
docker logs -f <worker_container_id>
```

Log in at `https://admin.retrospectiva.com` with an `ALLOW_USERS` credential.

---

## 9 · Connect Etsy (one-time)

`ETSY_SHOP_ID` is populated after the OAuth connect, not at boot. In the
running admin, go to the Etsy connect flow; the redirect must exactly match
`ETSY_REDIRECT_URI`
(`https://admin.retrospectiva.com/api/etsy/oauth/callback`) — register that
same URI in the Etsy developer app. See
[etsy-developer-app.md](./etsy-developer-app.md).

---

## 10 · Redeploys

Push to the deploy branch and hit **Deploy** (or enable **Auto Deploy** /
webhook on the Compose service so a git push triggers it). After deploys that
include a new migration, redo step 7.

The reverse-proxy / rate-limit `X-Forwarded-For` concern from
[deployment.md](./deployment.md) is handled for you: Traefik sets the
forwarded headers, so per-IP throttling works without extra config.

---

## 11 · Lock down external access (bots, crawlers, strangers)

The app already ships several app-level guards (see
[security.md](./security.md)): every route except the login page is behind the
session gate in `proxy.ts`, `robots.txt` disallows all crawlers, and security
headers (`X-Robots-Tag: noindex`, `X-Frame-Options: DENY`, HSTS, CSP
`frame-ancestors 'none'`, etc.) are sent on every response from
`next.config.ts`.

`robots.txt` only stops **polite** crawlers. To actually keep strangers and
ill-behaved bots off the panel, add a network-level gate in front of Traefik.
Pick **one**:

### Option 1 — Traefik IP allowlist (simplest)

If you and Pia have static/known IPs (home, office, a VPN exit), restrict the
router to those. Add an `ipallowlist` middleware to the `app` service labels in
`docker-compose.dokploy.yml`:

```yaml
    labels:
      - traefik.enable=true
      - traefik.http.routers.retrospectiva-app.rule=Host(`admin.retrospectiva.com`)
      - traefik.http.routers.retrospectiva-app.entrypoints=websecure
      - traefik.http.routers.retrospectiva-app.tls.certresolver=letsencrypt
      - traefik.http.services.retrospectiva-app.loadbalancer.server.port=3000
      # only these source IPs reach the app; everyone else gets 403
      - traefik.http.routers.retrospectiva-app.middlewares=rsv-allowlist
      - traefik.http.middlewares.rsv-allowlist.ipallowlist.sourcerange=203.0.113.4/32,198.51.100.0/24
```

Replace the CIDRs with your real addresses. Caveat: if the VPS sits behind
Cloudflare or another proxy, Traefik sees the proxy IP, not the client —
you'd need `ipallowlist.ipstrategy.depth` to read the right hop in
`X-Forwarded-For`. With Dokploy's default direct Traefik exposure, the client
IP is correct as-is.

### Option 2 — Cloudflare Access / Zero Trust (best for roaming IPs)

If your IPs change (mobile, travel), put the domain behind
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/):

1. Proxy `admin.retrospectiva.com` through Cloudflare (orange cloud).
2. Zero Trust → **Access → Applications → Add** a self-hosted app for that
   hostname.
3. Policy: **Allow** only your two emails (one-time PIN or Google login). Every
   request without a valid Access session is blocked at Cloudflare's edge,
   before it ever reaches the VPS.
4. Lock the VPS firewall so `443` only accepts Cloudflare's IP ranges — stops
   anyone bypassing Access by hitting the origin directly.

This gives an **identity-based** gate (login at the edge) on top of the app's
own auth — defence in depth, and the panel is never exposed to the open
internet.

### Option 3 — Tailscale / WireGuard (most private)

Don't publish the admin to the public internet at all: bind it to a private
VPN and reach it over Tailscale. Strongest isolation, slightly more setup
(install Tailscale on the VPS, point the domain at the tailnet IP, drop the
public Traefik route). Overkill for most, but it means zero public attack
surface.

### VPS firewall baseline (do this regardless)

```sh
ufw default deny incoming
ufw allow 22/tcp            # SSH — better: restrict to your IP
ufw allow 80,443/tcp        # Traefik (or only Cloudflare ranges for Option 2)
ufw deny 3000/tcp           # Dokploy dashboard — reach it over SSH tunnel, not public
ufw enable
```

Exposing the Dokploy dashboard (`:3000`) to the public internet is the biggest
footgun — keep it firewalled and tunnel in via
`ssh -L 3000:localhost:3000 user@vps`.

---

## Backups

Dokploy can schedule volume/database backups under the service's **Backups**
tab (S3-compatible destination — your R2 works). At minimum, a weekly Postgres
dump off the VPS:

```sh
docker exec -t <postgres_container_id> pg_dump -U retrospectiva retrospectiva \
  | gzip > retrospectiva-$(date +%F).sql.gz
```

R2 has its own durability; the Postgres volume is the irreplaceable part. The
local-dev `down -v` warnings in [deployment.md](./deployment.md) apply here
too — never wipe the production data volume.

---

## Option B — managed databases + two Applications

More "Dokploy-native"; nicer if you want the built-in DB backups/metrics and
separate logs per process. Trade-off: two App services to build the same
image, and you wire the connection strings by hand.

1. **Create Database → PostgreSQL** (image `postgres:17`). Note the internal
   connection string Dokploy shows.
2. **Create Database → Redis**. Note its internal URL.
3. **Create Application → app**: Git provider = this repo, Build Type =
   **Dockerfile**. The Dockerfile's default `CMD` (`pnpm start`) runs the web
   server. Add a **Domain** (`admin.retrospectiva.com`, port `3000`, HTTPS).
4. **Create Application → worker**: same repo/Dockerfile, but set the start
   **Command** override to `pnpm worker:prod`. No domain.
5. Put the same env block from step 4 on **both** apps, but here you **do** set
   `DATABASE_URL` and `REDIS_URL` to the managed databases' internal URLs from
   steps 1–2.
6. Deploy both. Run the migration once via the **app** Application's terminal:
   `pnpm db:migrate`.

Everything else (Etsy connect, verify, backups) is identical.
