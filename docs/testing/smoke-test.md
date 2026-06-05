# Phase 6 smoke checklist

Manual verification pass to run before declaring Phase 6 shippable.
The unit suite (`pnpm test`) covers the leaf logic; this is for the
integrated flows that span the browser ↔ Postgres ↔ Redis ↔ OpenAI
boundaries and aren't worth wiring up as automated E2E yet (full
Playwright lands alongside Phase 4c, see
[roadmap.md](../overview/roadmap.md)).

Time: ~20 minutes if everything works. Note anything that surprises
you — the goal is to catch UX regressions and timing issues the
typecheck + unit tests can't.

---

## 1 · Boot

In three terminals (Docker Compose can collapse the first two):

```bash
pnpm compose            # postgres + redis
pnpm dev                # Next.js
pnpm worker             # BullMQ consumer
```

Expect on the worker side:

```
[worker] starting…
[ai-enrich] registered worker for queue: ai-enrich
[etsy-publish] registered worker for queue: etsy-publish
[worker] ready
```

Quality gates (all should pass clean):

- [ ] `pnpm typecheck`
- [ ] `pnpm lint` — 0 errors (warnings on `_var` underscore-prefix are expected)
- [ ] `pnpm test`
- [ ] `pnpm build`

---

## 2 · Auth

- [ ] `/login` accepts the `ALLOW_USERS` credentials.
- [ ] Wrong password rate-limits after 5 attempts (in-memory, per IP+username).
- [ ] Cookie persists across reload; sliding 7-day window extends on each request.

---

## 3 · Products list (`/products`)

- [ ] Default tab is **Borradores**.
- [ ] Tab switch updates the URL (`?tab=published`, etc.) and the list.
- [ ] Search uses unaccent-ILIKE — `"vestidos"` matches `"VESTIDOS"`.
- [ ] Pagination buttons work; size selector persists per session.
- [ ] Column visibility selector persists in `localStorage`.

---

## 4 · New product · stepper happy path

Start from `/products/new`. Expect immediate redirect to
`/products/[id]?step=inputs` (auto-created draft).

### Step 1 — inputs

- [ ] Pick a clothing type (e.g. `vestido`).
- [ ] Condition, sizes (incl. "One Size"), price, currency.
- [ ] Measurements only show the rows the registry says this garment
      needs. Doubled values render alongside flat.
- [ ] Upload at least one photo via the merged dropzone.
- [ ] "Siguiente" button enables once the required fields are set.

### Click "Siguiente"

- [ ] Worker terminal prints `[ai-enrich] started · product=…`.
- [ ] After ~10–30 s: `[ai-enrich] completed · …`.

### Step 2 — AI review

- [ ] Skeleton renders while the job is in flight.
- [ ] Once succeeded, AiContentSection appears with `titleEs`,
      `descriptionEs`, `etsyTagsEs`, `etsyMaterialsEs`, `etsyWhenMade`
      pre-filled.
- [ ] **No EN toggles anywhere.** Spanish only (translation runs at
      the Etsy-publish boundary, not here).
- [ ] **No "Categoría Etsy" picker.** Taxonomy is derived from the
      step-1 garment.
- [ ] **"Regenerar" button** in the card header. Click it →
      confirmation prompt does NOT appear (stepper context), but the
      worker re-runs and the section remounts with new content.
- [ ] Edit any field manually → autosave fires (debounced 500 ms);
      Guardado · hace Xs in the indicator.

### Idempotency check (key behavior)

- [ ] Click "Anterior" back to step 1 → no AI re-run.
- [ ] Click "Siguiente" again → **no spurious OpenAI call**
      (worker terminal stays silent). The skip-when-succeeded
      check in `enqueueEnrichJob` prevents this from burning tokens.

### Step 3 — summary

- [ ] Photos thumbnail grid (first 5).
- [ ] Title + description in Spanish, no EN toggle.
- [ ] Tags + materials as Spanish chips, no EN toggle.
- [ ] "Detalles de Etsy" section shows clothing type, condition,
      when_made (no raw taxonomy id).
- [ ] Measurements in doubled (boundary) form.

### Step 4 — publish

- [ ] **Guardar borrador** → returns to `/products`, status = `draft`.
- [ ] **Programar** → time picker, accepts 5–min lead minimum,
      rejects past dates, rejects > 6 months out.
- [ ] **Publicar ahora** → flips status to `published` (stub
      processor; Phase 4c will replace with the real Etsy push).

---

## 5 · Scheduled publish (Task 9 stub)

- [ ] Schedule a product 5 minutes in the future.
- [ ] Verify in DB: `status='scheduled'`, `scheduled_publish_at`
      = your picked time (UTC), and a delayed BullMQ job exists
      (`redis-cli ZRANGE bull:etsy-publish:delayed 0 -1`).
- [ ] **Cancel before fire**: click "Cancelar programación" →
      status flips back to `draft`, the delayed job is gone.
- [ ] **Re-schedule**: pick a new time after the first one → only
      one delayed job remains (remove-then-add).
- [ ] **Let it fire**: wait until the picked time. Worker logs
      `[etsy-publish] started → completed`. DB row flips to
      `published`. Run ID stored. (No actual Etsy push yet — that's
      Phase 4c.)
- [ ] **Race coverage** (optional, hard to reproduce): cancel at
      the exact moment the delay fires. Worker logs
      `[etsy-publish] skipped · reason=status` — the row stays as
      `draft` because the worker's race-safety check trumps a
      late-arriving cancel.

---

## 6 · Edit form (non-draft products)

Open a `published` or `archived` product → flat form, no stepper.

- [ ] Identity section: garment type, condition, sizes, price,
      measurements all editable with autosave.
- [ ] AiContentSection: ES-only, all fields editable, no EN UI.
- [ ] **Regenerar button** in the AiContentSection header. Click
      it → `window.confirm()` warns about overwriting manual edits.
      Confirm → toast "Regenerando contenido…" → polling until done
      → router.refresh → new content visible.
- [ ] Media section: photos + videos managed via the same uploader
      as the stepper.
- [ ] Etsy section: archive / restore-to-draft / cancel-schedule
      actions match the row's current status.

---

## 7 · Known gaps (not in scope for Phase 6)

These are tracked but explicitly NOT covered by this smoke pass:

- Real Etsy API push — Phase 4c.
- Real Etsy taxonomy IDs — `taxonomy.ts` still has `0` placeholders.
- Per-product on-model AI image — Task 11 (waits on Model Studio
  in Task 8).
- Webhook out to the public website — Phase 7.
- Dashboard / activity feed UI — Phase 8.
- Brand-voice text in `BRAND_VOICE_PROMPT` env — user-provided asset.

---

## 8 · If something is off

- Compare against the recent decisions log in
  [roadmap.md](../overview/roadmap.md) — most non-obvious behavior is documented
  there with the "why" attached.
- For AI-flow issues, check `ai_runs` in Postgres. Each call inserts
  a row with `kind`, `status`, `input_json`, `output_json`,
  `cost_usd` — usually enough to diagnose.
- For queue issues, `redis-cli` against the
  `bull:ai-enrich:*` / `bull:etsy-publish:*` keys shows the state.
  The worker also prints structured `[ai-enrich] / [etsy-publish]
  started/completed/failed/skipped` lines.
