---
name: drizzle-migrations
description: How to author, test, and ship Drizzle/Postgres schema migrations in this project without corrupting migration history. Use when changing src/lib/db/schema.ts, generating migrations, resolving migration conflicts after a branch merge, or touching the migrate step in docker-compose. Covers why deploy uses migrate (not push) and how to squash a broken history before there is prod data.
user-invocable: false
---

# Drizzle Migrations

`schema.ts` is the single source of truth. Migrations are generated FROM it,
applied at container boot, and are append-only history. The whole class of
deploy failures this project hit (duplicate `ADD COLUMN`, a fresh DB that
won't replay) came from breaking the rules below — follow them.

## The golden rules

1. **Never hand-edit a generated `.sql` file or `meta/_journal.json`.** Change
   `schema.ts`, then regenerate. Editing SQL by hand desyncs the snapshot in
   `meta/` from the real schema and the next `generate` produces garbage diffs.

2. **Generate migrations on ONE branch, after merging schema changes.** The
   `0000`, `0001`… indexes are global and ordered. Two feature branches that
   each run `db:generate` will both produce a migration with the same index /
   the same `ADD COLUMN`; merging them yields a history that adds the same
   column twice and dies on a fresh replay (Postgres `42701`). If you must
   work schema changes in parallel, generate the migration only *after* the
   `schema.ts` changes are merged — or delete the branch's migration and
   regenerate post-merge.

3. **Always test the replay on a FRESH, EMPTY database before merging.** A
   migration that "works" locally only because your dev DB already has the
   column is a landmine for prod (whose DB is empty). See the recipe below.
   The check must reach all tables and EXIT 0.

4. **Deploy applies migrations with `migrate`, never `push`.** `db:push`
   diffs `schema.ts` straight onto the DB — no version trail and it will DROP
   columns/tables to match. It is a dev-only convenience. Production runs the
   versioned migrations via the dedicated one-shot `migrate` service in
   `docker-compose.yml` (see the deploy section below).

## Day-to-day workflow

```
# 1. edit src/lib/db/schema.ts
pnpm db:generate            # writes src/lib/db/migrations/000N_*.sql + meta snapshot
# 2. READ the generated .sql — confirm it does only what you intended
# 3. replay on a fresh DB (recipe below) — must create all tables and exit 0
# 4. commit schema.ts AND the new migration files together, in one commit
```

Never commit a `schema.ts` change without its migration, or vice versa.

## Fresh-DB replay test (the guardrail)

```sh
docker run -d --name mig-test -p 55432:5432 \
  -e POSTGRES_USER=r -e POSTGRES_PASSWORD=r -e POSTGRES_DB=r postgres:17-alpine
# wait for readiness, then:
DATABASE_URL='postgres://r:r@localhost:55432/r' \
  node_modules/.bin/tsx src/lib/db/migrate.ts        # must print "migrations up to date" and exit 0
docker exec mig-test psql -U r -d r -c \
  "select count(*) from information_schema.tables where table_schema='public';"
docker rm -f mig-test
```

If `migrate.ts` errors (e.g. `column already exists`), the history is
inconsistent — fix `schema.ts`/regenerate; do NOT paper over it with
`IF NOT EXISTS` edits to the SQL.

## How migrations run at deploy (compose)

A dedicated one-shot `migrate` service runs the migrations and exits; `app` and
`worker` both wait for it via `depends_on: condition: service_completed_successfully`.
Boot order: `postgres healthy → migrate completes (exit 0) → app + worker start`.

This is preferred over an inline `migrate && start` in the app command: the
inline form only gates the app, leaving the **worker** to race the migration.
A separate service gates both and keeps migration decoupled from serving.

`migrate.ts` (not `drizzle-kit migrate`) is what the service runs:
`drizzle-kit migrate` applies the SQL but does not terminate cleanly under the
`postgres` driver — the open connection keeps the event loop alive and the
process hangs. `src/lib/db/migrate.ts` uses drizzle-orm's runtime migrator,
closes the connection in `finally`, and `process.exit`s with a real status code
(exit 1 on failure → `service_completed_successfully` is NOT met → app/worker
do not start).

Call binaries directly in containers (`node_modules/.bin/tsx …`), not
`pnpm db:migrate` — `pnpm <script>` triggers pnpm v11's verify-deps-before-run,
which fails with no TTY inside the image.

## Squashing a broken history (only before there is prod data)

If migration history is already corrupted and the DB has no data worth keeping
(e.g. first ship), collapse to one clean baseline:

```sh
rm -rf src/lib/db/migrations
pnpm db:generate                      # regenerates a single 0000 baseline from schema.ts
# then run the fresh-DB replay test above to confirm it applies cleanly
```

Do this ONLY pre-prod. Once a migration has run against a database holding real
data, it is immutable history — add new migrations forward instead.
