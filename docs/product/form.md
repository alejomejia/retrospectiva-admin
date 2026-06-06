# Product form (list, create, edit)

How a product moves from "blank draft" to "ready to publish" inside
the admin. Covers three surfaces:

1. `/products` — the catalog list (filters, tabs, search, pagination,
   column selector).
2. `/products/new` → `/products/[id]` — the **2-step stepper** for a
   fresh draft (publish actions live in the always-visible right rail).
3. `/products/[id]` for non-fresh-draft products — the **flat edit
   form**.

The AI side of step 2 lives in its own doc:
[ai-enrichment.md](../ai/enrichment.md). The Etsy publish side lives in
[etsy-listing-payload.md](../etsy/listing-payload.md). This file is the
form/UX source of truth.

---

## 1 · /products — the list view

### Routing + state

Server component reading `await searchParams`. URL params drive the
query; nothing is held in client state except the column selector
preferences (those live in `localStorage`, since URL bloat for a
shareable filtered link is the bigger cost).

```
?tab=activos
&q=vestido
&priceMin=10&priceMax=80
&from=2026-01-01&to=2026-05-17
&page=2&pageSize=20
```

### Tabs (the only status switcher)

There is **no separate status filter** — tabs replace it. The filter
panel only covers price + date range + future product-specific filters.

| Tab key | Filter | Notes |
| --- | --- | --- |
| `drafts` (default) | `status='draft'` | Where most day-to-day work happens; new products land here. |
| `published` | `status='published'` | Live inventory on Etsy. |
| `scheduled` | `status='scheduled'` | Sorted by `scheduled_publish_at ASC` so the next-to-go is first. |
| `archived` | `status IN ('archived','sold')` | Sold-out items end up here. |

### Filter bar

Driven by a `FilterDefinition[]` array in `src/lib/products/filters.ts`.
Each definition has `{ key, type, label }` where `type` ∈ `'number-range'
| 'date-range' | 'multi-select' | 'text'`. Adding a new filter = one
array entry + one branch in the `WHERE`-builder. No premature
abstraction beyond that.

Ships with: price (number-range), creation date (date-range).

### Search

- Debounced 250 ms on the client.
- Postgres `ILIKE` over `unaccent(title_es)` so an accent typo (`vestido` vs
  `véstido`) doesn't kill the match.
- One-time migration adds `CREATE EXTENSION IF NOT EXISTS unaccent`.

### Pagination

- Page-based, `?page=` + `?pageSize=`. Default 20. Selector exposes
  `[10, 20, 50]`.
- Server returns `{ rows, totalCount }`; the UI shows `Mostrando 21–40
  de 137`.
- Sort is fixed at `created_at DESC`. Column-header sorting is a
  carried TODO.

### Column selector

- Trigger: `<Button variant="ghost"><Settings2 /></Button>` top-right.
- Popover content: a dnd-kit sortable list of column rows, each with a
  visibility checkbox. Drag to reorder; toggle to hide/show.
- Persists to `localStorage['products.columns']` as
  `[{ key, visible }, …]`. "Restablecer" resets to defaults.
- Default columns, in order:
  1. Thumbnail (first product image at `order = 0`)
  2. Title (`title_es`)
  3. Status badge
  4. Etsy price (computed: base × markup, with override)
  5. Creation date

---

## 2 · The 2-step stepper (new product flow)

`/products/new` (a `route.ts`) auto-creates a `status='draft'` row and
redirects to `/products/[id]`. If the product is a fresh draft with no
AI run yet, that page renders the **stepper**. Otherwise it renders the
flat edit form (§4).

The stepper is a custom component (no shadcn equivalent) — documented
in `DESIGN_SYSTEM.md §6`.

### Autosave

- Every field change kicks `updateProductDraftField` (server action),
  debounced 500 ms.
- A "Guardado · hace 2s" indicator in the corner gives confidence.
- Survives refresh, navigation, connection blips. There is no
  `localStorage` fallback; the draft row IS the source of truth.

### Step 1 — User inputs

All fields the user enters directly. AI is not invoked here.

| Field | Storage | Notes |
| --- | --- | --- |
| Base price | `base_price_cents` | What the user wants to earn. Live hint next to the input: `Etsy: €XX,XX` (base × markup). |
| Markup override | `markup_percent_override` (smallint, nullable) | Collapsed "ajustar margen" toggle. Falls back to shop-wide `etsy_oauth.markup_percent` (default 30). |
| List-price override | `list_price_cents_override` (int, nullable) | Editable inline; step 1 also shows the live computed hint. |
| Clothing type | `clothing_type` (enum) | Combobox grouped by category (Upper / Lower / Complete / Special). |
| Condition | `condition` (enum) | `perfect | very_good | good`. |
| Sizes | `sizes text[]` | Multi-select chips: `XS S M L XL XXL`. |
| Measurements | individual `*_cm` int columns | Rendered dynamically by clothing type. See §3. |
| Bra size | `bra_size text` | Only when clothing type is `corset`. |
| Images + video | existing `product_images` / `product_videos` | Uses the Phase 3 MediaUploader. |

The product title (`title_es`) is **not** entered in step 1 — AI
generates it in step 2 from the photo + the inputs above.

**Validation to enable Next**: zod schema requires `clothing_type`,
`condition`, `base_price_cents`, and ≥ 1 image. Measurements are all
optional (per requirement 2d). Tags/materials/title are AI's job.

**On Next click**: enqueue an `ai-enrich` job for the product, navigate
to `/products/[id]?step=2`.

### Step 2 — AI review

Renders all AI-generated fields, each editable. While the AI job is
still running, the page polls `/products/[id]/ai-status` every 2 s and
shows skeletons in place of the not-yet-filled fields.

| AI field | Storage | Edit shape |
| --- | --- | --- |
| Title | `title_es`, `title_en` | Single text input (ES). Collapsible "Ver versión en inglés" with the EN value + "Regenerar traducción". |
| Description | `description_es`, `description_en` | Multi-line textarea (ES) + same EN collapsible. |
| Tags | `etsy_tags_es text[]`, `etsy_tags_en text[]` | Chip input on the ES array; EN parallel auto-translated. |
| Materials | `etsy_materials_es text[]`, `etsy_materials_en text[]` | Same chip-input shape as tags. |
| Era | `etsy_when_made` | Select with the Etsy enum (`1990s`, `1980s`, `1970s`, `1960s`, `1950s`, `before_1950`). |
| Taxonomy | `etsy_taxonomy_id` | Select from the curated short list in `src/lib/integrations/etsy/taxonomy.ts`. |
| Model image | `product_images` row with `role='ai_model'` | Image preview + 🔄 regenerate; hard-deletes the prior `role='ai_model'` row + R2 object on each regenerate. |

Each field is wrapped in an `<AiField>` component: input + spinner
state + "🔄 regenerar" button + (for text fields) the EN collapsible.

**ES → EN translation flow**: edits to the ES side debounce 500 ms
then enqueue an `ai-translate` job, which updates the EN counterpart.
The EN collapsible shows a small "Actualizando…" indicator while
running.

**AI failure handling**: if the `ai-enrich` job fails, step 2 still
renders with the fields **empty and editable**. A top-of-page banner
explains in Spanish and offers a "Reintentar todo" button. Publishing
is never blocked by an AI failure — every field can be filled by hand.

There is no separate "summary preview" step: step 2 is already the
final review surface. The user edits or regenerates any field
in-place and then fires the publish action from the right rail.

### Publish sidebar (always visible)

The right rail of the stepper, visible on every step. Three terminal
actions:

| Action | Effect |
| --- | --- |
| **Guardar borrador** | Flush any pending autosave; navigate to `/products`. Status stays `draft`. |
| **Programar** | Open `<SchedulePicker />` (date-time, Europe/Madrid display, UTC stored, ≥ 5 min lead, ≤ 6 months ahead). Sets `status='scheduled'` + `scheduled_publish_at`; enqueues a BullMQ delayed `etsy-publish` job. |
| **Publicar ahora** | Enqueue an immediate `etsy-publish` job. Status flips to `published` once the processor confirms (Phase 4c). Until Phase 4c lands, the job logs "publish not implemented" and bails — the wiring is provable, the side effect is a no-op. |

Both publish buttons are disabled until the **required Etsy fields**
are non-empty: `title_en`, `description_en`, `etsy_taxonomy_id`,
`etsy_when_made`. Tags and materials are optional. The list-price
override input lives next to the price field on step 1, so the user
can nudge the Etsy price right before going live without leaving the
current step.

---

## 3 · Garment registry + measurement form

Single source of truth: `src/lib/products/clothing-types.ts`. Adding a
new garment = one entry in the registry.

```ts
type ClothingTypeEntry = {
  value: ClothingType;          // db enum value
  label: string;                // Spanish label shown in the UI
  category: 'upper' | 'lower' | 'complete' | 'special';
  measurements: Measurement[];  // which fields show up in step 1
  twoXMeasurements: Measurement[]; // subset that doubles for Etsy/website
};
```

Built-in entries (must match the `clothing_type` Postgres enum):

| value | label | category | measurements | doubles |
| --- | --- | --- | --- | --- |
| `shirt` | Camisa | upper | shoulder, chest, length | chest |
| `vest` | Chaleco | upper | shoulder, chest, length | chest |
| `top` | Top | upper | shoulder, chest, length | chest |
| `sweater` | Jersey | upper | shoulder, chest, length | chest |
| `jacket` | Chaqueta | upper | shoulder, chest, length | chest |
| `trench_coat` | Gabardina | upper | shoulder, chest, length | chest |
| `corset` | Corset | special | chest, length, bra_size | chest |
| `jean` | Jean | lower | waist, hip, rise, leg, length | waist, hip, leg |
| `pant` | Pantalón | lower | waist, hip, rise, leg, length | waist, hip, leg |
| `skirt` | Falda | lower | waist, hip, length | waist, hip |
| `short` | Short | lower | waist, hip, rise, leg, length | waist, hip, leg |
| `set` | Set | complete | shoulder, chest, waist, hip, rise, leg, length | chest, waist, hip, leg |
| `overall` | Mono | complete | shoulder, chest, waist, hip, rise, leg, length | chest, waist, hip, leg |
| `dress` | Vestido | complete | shoulder, chest, waist, hip, length | chest, waist, hip |
| `bodysuit` | Body | complete | (none) | — |

### Store-flat, double-at-the-boundary

The user measures with a tape across the **flat** garment. We store
that flat value. Whenever we cross a boundary:

- **Form hint**: chest input shows `Plano: 44 cm · Contorno: 88 cm`
  live so the user can sanity-check.
- **Etsy description**: the publish payload includes a measurement
  block in centimeters using the doubled (circumference) values.
- **Website webhook**: same — circumference values in the payload.

Helpers in `src/lib/products/measurements.ts`:

```ts
export function doubledMeasurements(p: Product): ProductMeasurements;
export function flatMeasurements(p: Product): ProductMeasurements;
```

Never double inside the form layer. Storage is canonical-flat.

### Resorted (elastic) waist — min/max

Waist is stored as a min/max pair. `waist_cm` is the minimum and the
default — for a non-elastic garment it's the only value entered. A
"Cintura resortada" toggle in the form reveals an optional
`waist_max_cm` for elastic/resorted waistbands. Both values double at
the boundary when the clothing type marks `waist` as x2.

The enrichment prompt phrases the waist accordingly: with both values
present it writes **"cintura mínima X · cintura máxima Y"**; with only
the minimum it writes plain **"cintura X"** (never "cintura mínima").

---

## 4 · Edit experience (flat form)

`/products/[id]` falls through to a flat single-page form whenever the
product is **not** a fresh draft (anything besides `status='draft'`
with zero `ai_runs` rows).

Sections:

1. **Identidad** — `title_es` (Spanish title, also the displayed name
   across the app), base price + Etsy price hint + override input,
   condition, sizes, clothing type, measurements.
2. **Contenido IA** — title (ES + EN collapsible), description, tags,
   materials, era, taxonomy, model image. Each wrapped in the same
   `<AiField>` component as step 2 of the stepper.
3. **Medios** — image and video galleries (existing Phase 3
   components).
4. **Etsy** — status badge, current Etsy listing ID, quick actions:
   "Publicar ahora", "Programar", "Volver a borrador", "Archivar". A
   "Regenerar todo con IA" button at the top of the IA section
   re-enqueues the full pipeline (confirmation dialog — it costs money
   and overwrites edits).

Autosave applies here too — same per-field debounced behavior as the
stepper.

---

## 5 · Storage shape (cheat sheet)

All on `products` (1-2 user shop, no need for side tables):

```
-- Identity
id, status, created_at, updated_at, etsy_listing_id, etsy_state, sold_at

-- Pricing
base_price_cents, currency, markup_percent_override, list_price_cents_override

-- Main user provided inputs
clothing_type, condition, sizes text[],
shoulder_cm, chest_cm, waist_cm, waist_max_cm, hip_cm, rise_cm, leg_cm, length_cm,
bra_size

-- AI / Etsy content (bilingual)
title_es, title_en,
description_es, description_en,
etsy_tags_es text[], etsy_tags_en text[],
etsy_materials_es text[], etsy_materials_en text[],
etsy_when_made, etsy_taxonomy_id,

-- Scheduling
scheduled_publish_at
```

Shop-wide config:

```
etsy_oauth.markup_percent  -- smallint, default 30
```

`name` was dropped — `title_es` is the single Spanish name shown
everywhere in the admin (and the source for the Etsy ES translation).

---

## 6 · Scheduled publish mechanics

- Storage: `status='scheduled'` + `scheduled_publish_at` (timestamptz,
  UTC).
- Queue: `etsy-publish` BullMQ queue. The product gets enqueued with
  `{ jobId: 'etsy-publish:' + productId, delay: scheduledAt - now }`.
- Reschedule: `queue.remove(jobId)` + new add with the new delay.
- Cancel: `queue.remove(jobId)` + set `status='draft'`, clear
  `scheduled_publish_at`.
- The processor itself is Phase 4c territory. Until then the queue +
  job stubs are in place so we can verify the UX without actually
  hitting Etsy.

UI on `/products/[id]` for a `scheduled` product:

```
Programado para el 23 de junio, 18:00 · Europe/Madrid
[ Reprogramar ]   [ Cancelar programación ]
```

Picker constraints:

- Display in `Europe/Madrid`, persist UTC.
- Minimum lead time: 5 minutes from now.
- Maximum sanity cap: 6 months.

---

## 7 · Carried TODOs

These are deliberately deferred and tracked in `roadmap.md` Open
TODOs:

- Column-header sorting on /products (default is `created_at DESC`).
- Bulk operations on /products (multi-select to archive, schedule, …).
- Real publish processor in `etsy-publish` (Phase 4c).
- Real model images uploaded to `assets/models/` in R2 (placeholder
  set ships with Phase 6; production set is user-provided).
