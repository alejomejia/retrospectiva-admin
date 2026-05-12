# Database setup

The admin panel uses Postgres + Drizzle ORM. Setting up a working DB has two
moving pieces beyond just defining `DATABASE_URL`: the server has to be
running, and the schema has to be applied. The full sequence is below.

## 1 · Start Postgres + Redis

The compose file at the repo root is already wired with the right user,
password, database name, and a healthcheck.

```sh
docker compose up -d postgres redis
docker compose ps              # both should show "healthy"
```

First run pulls the images and creates the data volumes. Subsequent runs
reuse them.

## 2 · Set `DATABASE_URL` to point at the running service

For local dev — meaning you run `pnpm dev` on the host while Postgres lives
in a container — the URL has to use `localhost`, not the compose service
name:

```sh
# .env.local
DATABASE_URL=postgres://retrospectiva:retrospectiva@localhost:5432/retrospectiva
```

The user, password, and database name (`retrospectiva` / `retrospectiva` /
`retrospectiva`) come from the `postgres` service in `docker-compose.yml`.

> **Heads-up.** `postgres://retrospectiva:retrospectiva@postgres:5432/…` (with
> the host `postgres`) is only correct when the app itself runs inside the
> compose network — e.g. `docker compose up app`. From the host machine it
> won't resolve.

## 3 · Apply the migration

The first migration is already generated and committed at
`src/lib/db/migrations/0000_icy_scourge.sql`. Apply it:

```sh
pnpm db:migrate
```

Drizzle logs the file name and creates 6 tables (`products`,
`product_images`, `ai_runs`, `events`, `etsy_oauth`, `jobs_idempotency`),
4 enums, and the indexes.

## 4 · (Optional) verify with Drizzle Studio

```sh
pnpm db:studio
```

Opens a web UI at <https://local.drizzle.studio> showing the tables (all
empty at this point).

You should now be able to refresh `/products` in the admin and see the
empty-state card.

---

## Day-to-day commands

| Command | What it does |
| --- | --- |
| `pnpm db:generate` | Inspect `src/lib/db/schema.ts` and produce a new `NNNN_*.sql` migration file. Run after any schema change. |
| `pnpm db:migrate` | Apply pending migration files against `DATABASE_URL`. Run after pulling new migrations from main. |
| `pnpm db:push` | Sync the schema to the DB **without** going through migration files. Faster for early-development iteration; never use against a DB that contains real data. |
| `pnpm db:studio` | Browse the DB in a web UI. Useful for quick inspection / fixes. |

## Workflow when changing the schema

1. Edit `src/lib/db/schema.ts`.
2. `pnpm db:generate` — produces the next `NNNN_*.sql` file in
   `src/lib/db/migrations/`.
3. Review the SQL diff (think hard about destructive operations: column
   drops, type narrowing, `NOT NULL` adds, etc.).
4. `pnpm db:migrate` — applies it locally.
5. Commit both the schema change and the generated SQL file together.

## Troubleshooting

### `Please provide required params for Postgres driver: [x] url: undefined`

drizzle-kit is a standalone Node CLI; it doesn't automatically load
`.env.local`. The repo's `drizzle.config.ts` calls `loadEnvConfig()` from
`@next/env` at import to load the same files Next uses, so this should
"just work". If you still see this error:

1. Check `.env.local` exists and `DATABASE_URL=…` is actually in it (no
   leading whitespace, no smart quotes from copy-paste).
2. Verify `loadEnvConfig` is still being called at the top of
   `drizzle.config.ts` — removing it brings this error back.
3. As a workaround, inline the var for one command:
   `DATABASE_URL=postgres://… pnpm db:migrate`.

### `connect ECONNREFUSED 127.0.0.1:5432`

Postgres isn't running, or it's running but on a different port.

```sh
docker compose ps
docker compose logs postgres
```

If the container is unhealthy, restart it:

```sh
docker compose restart postgres
```

### Migrations fail mid-apply

Drizzle stops at the first failing statement. The DB is now in a partial
state. For local dev, the safest reset is to nuke the data volume and
re-apply from scratch:

```sh
docker compose down -v
docker compose up -d postgres redis
pnpm db:migrate
```

> The `-v` flag deletes the data volume. **Only ever use it locally.** Once
> there are real products in the DB, never run this against the production
> stack — back up first.

### "relation `products` does not exist"

The schema hasn't been applied to the database `DATABASE_URL` points at.
Either run `pnpm db:migrate`, or check that your URL points to a database
where migrations *have* run.

### Connection works but writes fail with `relation … does not exist`

You probably ran `pnpm db:push` against one database and then pointed the
app at a different one. Verify with `pnpm db:studio` that the tables are
in the database you expect.

## Production notes

- The `app` and `worker` services in `docker-compose.yml` both expect
  `DATABASE_URL` to use the service name `postgres` (the internal compose
  hostname), not `localhost`.
- Always apply migrations during deploys, not at app boot. The `app`
  container itself does not run migrations — you run `pnpm db:migrate`
  from a one-off task before bringing up the new app version.
- Back up before running any new migration in prod. `pg_dump` to a file in
  the VPS's persistent storage is enough for a two-user shop; rotate
  weekly.
