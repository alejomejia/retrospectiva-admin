# Model Studio (`/models`)

The admin surface for **creating, curating, and managing the shop's
library of synthetic AI fashion models**. This is the home of the
[Phase 1 base model](./phase-1-base-model.md) generation workflow,
and the long-term home of the Phase 2-4 preview workflows once those
prompts are drafted.

It is **decoupled from product creation**. Per-product image work
(applying a saved model + the product photo to produce the on-model
listing image) lives in the per-product flow and consumes the
library this Studio produces.

> Status: design doc. No code shipped. Blocked behind the Bilingual
> ES↔EN translation work (task #7). See
> [../roadmap.md](../roadmap.md).

---

## 1 · Why a dedicated section

Model generation has a different shape than product enrichment:

| Trait | Product enrichment | Model generation |
| --- | --- | --- |
| Frequency | Per-product, ~daily | Per-shop, ~quarterly |
| Subject | A real garment photo | A synthetic identity to reuse |
| Output | Goes straight into a listing | Goes into a curated library |
| QA flow | Inline edits in step 2 | Side-by-side compare + pick |
| Failure cost | Re-enqueue, low cost | One bad face would leak into every product |

Treating model generation as a separate admin workflow lets us:

1. QA each model carefully before it ever touches a product.
2. Keep slow, expensive model-generation calls off the per-product
   critical path.
3. Build the right UI — gallery + compare — instead of bolting it
   onto the stepper.

---

## 2 · Sidebar placement

Top-level sidebar item, sibling of **Productos** — not nested under
Settings, because it's an active workflow rather than a config
screen.

```
Productos
Modelos          ← new
Pedidos
Ajustes
```

Suggested Spanish label: **Modelos**. URL: `/models` (English, per
the code-stays-English convention).

---

## 3 · List / gallery view

Visually mirrors `/products`: same tab/filter shell, same column
visibility logic, same per-row keyboard affordances. The data model
is different so the columns aren't identical, but the structure
should feel like a sibling page.

**Tabs** (status filter):

- **Activos** — default. `status='active'`. These are the models
  available for per-product image generation.
- **Borradores** — `status='draft'`. Generated but not yet saved /
  approved.
- **Archivados** — `status='archived'`. Excluded from selection;
  kept for audit / re-activation.

**Columns** (default visible):

| Column | Notes |
| --- | --- |
| Thumbnail | First panel (front full body) extracted from the contact sheet. |
| Label | User-chosen short name ("Lucía", "Sofía", …). |
| Ethnicity / Age | Compact summary from generation variables. |
| Body / Height | Compact summary. |
| Hair | One-line description. |
| Created | Relative time. |
| Status | Badge. |

**Hidden by default, available via the column-selector:** face
shape, skin tone, full hair description, generation cost, the seven
raw variable values (for cloning).

**Row actions:**

- Click row → detail page with full contact sheet + variable
  breakdown + actions (edit label, regenerate with same vars,
  archive).
- Per-row: archive, set as default for new products, clone-and-tweak
  variables.

---

## 4 · Detail / generation form

The "New model" form (and the "Regenerate" affordance on an existing
model) is organized into **sections that mirror the four phases of
the pipeline**, following the original ChatGPT recommendation that
seeded this work (see [source-notes.md](./source-notes.md)).

```
┌─────────────────────────────────────────────────┐
│ Identidad (Base)         ← active in v1         │
│   Edad           [select]                       │
│   Etnia          [select]                       │
│   Tipo de cuerpo [select]                       │
│   Altura         [select]                       │
│   Tono de piel   [select]                       │
│   Forma de cara  [select]                       │
│   Pelo           [select / freeform]            │
├─────────────────────────────────────────────────┤
│ Prenda (Garment)         ← disabled in v1       │
│   "Pendiente · Fase 2 del pipeline"             │
├─────────────────────────────────────────────────┤
│ Pose                     ← disabled in v1       │
│   "Pendiente · Fase 3 del pipeline"             │
├─────────────────────────────────────────────────┤
│ Entorno (Environment)    ← disabled in v1       │
│   "Pendiente · Fase 4 del pipeline"             │
└─────────────────────────────────────────────────┘
              ↓
         [ Generar ]
              ↓
   Contact-sheet preview · 6 panels
              ↓
   [ Guardar ]  [ Regenerar ]  [ Descartar ]
```

**Why all four sections show, even if three are inert in v1.** It
establishes the long-term IA so the page doesn't have to be
redesigned when Phase 2-4 prompts land. The disabled sections also
double as a roadmap surface — visible to the user, hard to forget
about.

**Active section in v1: Identidad (Base).** Each input is a `select`
populated from the canonical lists in
[phase-1-base-model.md §4](./phase-1-base-model.md#4--variables).
Free-form text is allowed only for `HAIR_DESCRIPTION` (the list is
representative but not exhaustive).

**Generation flow:**

1. User fills the Base section, clicks **Generar**.
2. Server action validates + enqueues an `ai-model-generate` job.
3. UI shows skeleton + polls
   `/models/[id]/generation-status`.
4. On success, server downloads the image from OpenAI, uploads to
   R2 under `assets/models/{model_id}/contact-sheet.jpg`, and
   inserts a row with `status='draft'`.
5. UI swaps to a side-by-side: contact sheet preview + the variable
   summary + three buttons:
   - **Guardar** → user picks a label, status flips to `active`.
   - **Regenerar** → re-enqueue with the same vars (cheap retry).
   - **Descartar** → delete the R2 object + DB row.

Failure path is the same shape as the enrichment step: banner +
retry, no autoplay.

---

## 5 · R2 layout

Aligns with the existing `assets/models/` prefix
([../ai-enrichment.md §6](../ai-enrichment.md)).

```
assets/
  models/
    {model_id}/
      contact-sheet.jpg     ← the 6-panel image (canonical)
      front-full.jpg        ← Panel 1, cropped (used by Phase 2)
      front-portrait.jpg    ← Panel 2, cropped (optional, for thumbnails)
```

`contact-sheet.jpg` is the source of truth and survives forever.
The cropped panels are derived artifacts — generated server-side
immediately after the contact sheet lands, so Phase 2's image-edit
call can attach a single front-facing image rather than the whole
sheet. Crop coordinates are computed from the known 2×3 grid
geometry of the contact sheet.

Cache-Control: `public, max-age=31536000, immutable` (1 year) on
both — same convention as Phase 3 product media. Filenames are
deterministic per `model_id`; regenerating a model overwrites the
previous files.

---

## 6 · Schema · `ai_models`

New table. Drizzle definition lives in `src/lib/db/schema.ts`
alongside `products` and `ai_runs`.

```ts
export const aiModelStatus = pgEnum("ai_model_status", [
  "draft",
  "active",
  "archived",
]);

export const aiModels = pgTable("ai_models", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Human-friendly identifier for the gallery + dropdown.
  label: text("label").notNull(),

  status: aiModelStatus("status").notNull().default("draft"),

  // Generation inputs — exact strings interpolated into the
  // Phase 1 prompt. Stored verbatim so we can re-render the
  // summary chips and "clone & tweak".
  ageRange: text("age_range").notNull(),
  ethnicity: text("ethnicity").notNull(),
  bodyType: text("body_type").notNull(),
  heightRange: text("height_range").notNull(),
  skinTone: text("skin_tone").notNull(),
  faceShape: text("face_shape").notNull(),
  hairDescription: text("hair_description").notNull(),

  // Where the artifacts live in R2.
  contactSheetKey: text("contact_sheet_key").notNull(),
  frontFullKey: text("front_full_key"), // null until crop succeeds
  frontPortraitKey: text("front_portrait_key"),

  // Audit.
  aiRunId: uuid("ai_run_id").references(() => aiRuns.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});
```

`ai_runs` gets a new `kind` value: `model_generation`. Same cost +
audit treatment as enrichment.

---

## 7 · Per-product model selection (out of scope for this task)

The product form gets a new field once both the Studio and the
per-product image-gen task ship:

```
┌─ Imagen en modelo ────────────────────────┐
│  Modelo  [ Aleatorio        ▾ ]           │
│          [ Aleatorio                    ] │
│          [ ───────────────────────────  ] │
│          [ Lucía  · latina, 28          ] │
│          [ Sofía  · east asian, 31      ] │
│          [ Marta  · nordic, 24          ] │
│          [ ───────────────────────────  ] │
│          [ Gestionar modelos →          ] │
└───────────────────────────────────────────┘
```

`Aleatorio` is the default. When the per-product image job runs
with `aiModelId = null`, the worker picks a random `status='active'`
row. Per-shop default ("siempre Lucía") is a stretch goal — easy
to add via a single column on `etsy_oauth` or a future `shop_config`
row.

This UI lands in task #11 (Per-product on-model image gen), not in
the Studio task itself.

---

## 8 · Lifecycle

```
                Generar
                   ▼
              [ draft ]
                /     \
       Guardar /       \ Descartar
              ▼         ▼
        [ active ]    (deleted)
              │
         Archivar
              ▼
       [ archived ]
              │
        Reactivar (optional)
              ▼
        [ active ]
```

- `draft` models don't appear in the per-product dropdown.
- `archived` models don't appear either, but the row + R2 object
  survive so any products that used the model retain provenance.
- Deletion is hard-delete (DB row + R2 objects). Only available
  from `draft`. Once active, the path forward is `archived`.

---

## 9 · Queue + worker

New BullMQ queue: `ai-model-generate`. Job shape:

```ts
type AiModelGenerateJob = {
  modelId: string; // pre-inserted row in `draft` status
};
```

Processor in `src/lib/integrations/openai/model-generate-worker.ts`:

1. Load `ai_models` row.
2. Interpolate variables into the Phase 1 prompt.
3. Call `gpt-image-2` (size = the largest the model supports for
   contact-sheet legibility — TBD when iterating).
4. Upload contact sheet to R2.
5. Crop Panel 1 + Panel 2 → upload as `front-full.jpg` and
   `front-portrait.jpg`. Crop math derived from the known 2×3 grid.
6. Update the row: `contactSheetKey`, `frontFullKey`,
   `frontPortraitKey`, `updatedAt`.
7. Insert an `ai_runs` row with `kind='model_generation'`.

Failure handling matches enrichment: 3 attempts, exponential
backoff, banner + retry in the UI, the row stays in `draft` until
the user resolves.

---

## 10 · Locked decisions

- **Top-level sidebar, not under Settings.** Active workflow.
- **`assets/models/{id}/contact-sheet.jpg` in R2.** Inherits the
  prefix already documented in `ai-enrichment.md`.
- **Form sections mirror the four pipeline phases.** Base active in
  v1, Garment/Pose/Environment scaffolded as visible-but-disabled.
- **All inputs are select fields,** drawn from the canonical lists
  in [phase-1-base-model.md](./phase-1-base-model.md). Only
  `HAIR_DESCRIPTION` allows free-form (curated list as suggestions).
- **One model = one contact sheet + cropped panels.** Regenerate
  overwrites the same R2 keys deterministically.
- **`status='draft' | 'active' | 'archived'`.** Mirrors the
  product lifecycle vocabulary.
- **Per-product selection defaults to `Aleatorio`.** Manual override
  per product; eventual per-shop default deferred.
- **Hard-delete only from `draft`.** Active/archived rows survive
  for audit + provenance.

---

## 11 · Open questions (decide while iterating)

- Exact image dimensions for the contact sheet — depends on what
  `gpt-image-2` can deliver legibly at the highest tier. Try 1536×2304
  (portrait) first.
- Whether to support tag-style descriptors on the gallery (e.g.
  "Tag a model as 'casual' vs 'editorial'") — defer until phases 3-4
  prompts exist, since the tags are most useful for preset routing.
- Whether the Studio also surfaces a Phase 2 "try-on preview" form
  before the per-product flow uses it — useful for prompt iteration,
  but not blocking the v1.
