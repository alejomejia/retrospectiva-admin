# Model generation

Reference material for the **AI fashion model** image-generation
pipeline used by the admin to produce on-model product imagery for
Etsy listings and social content.

This is the "Phase 7 / Task 7" image work referenced in
[../roadmap.md](../roadmap.md) and
[../ai-enrichment.md](../ai-enrichment.md) §6. Those docs describe
the queueing, R2 storage, and DB plumbing; **this folder is only
about the prompts themselves** — what we send to `gpt-image-2`,
what variables are interpolated, and what the model is expected to
produce.

> Status: documentation-only. No code under
> `src/lib/integrations/openai/` references these prompts yet. They
> are being iterated on against the live model before any of it is
> wired into the pipeline.

> **This work is decoupled from product enrichment.** The new-product
> stepper's step 2 (AI enrichment) does **not** generate models. The
> Model Studio (see [model-studio.md](./model-studio.md)) is a separate
> admin surface where the shop's library of synthetic models is built
> ahead of time. Per-product image generation later picks a model
> from that library; that wiring is its own task and is not part of
> the documents in this folder beyond a brief reference.

---

## 1 · Why a multi-phase pipeline

Building on-model imagery for ecommerce + social with `gpt-image-2`
breaks down naturally into four reusable stages. Each stage outputs
an artifact the next stage consumes, which keeps the prompts
modular and lets us swap one phase without rewriting the others.

```
   ┌──────────────────────┐
   │  Phase 1 · Base      │  one consistent woman
   │  model generation    │  ─►  6-panel contact sheet
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Phase 2 · Garment   │  apply the product to the model
   │  application         │  ─►  on-model fitting shot(s)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Phase 3 · Pose      │  natural / lifestyle posing
   │  transformation      │  ─►  social-ready variants
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  Phase 4 · Environ-  │  cafés, streets, interiors,
   │  ment generation     │  mirror selfies, editorial
   └──────────────────────┘
```

The chosen design principles, locked at the start:

1. **One model per generation, multiple views in the same image.**
   Generating a 6-panel contact sheet in a single call preserves
   identity far better than 6 separate generations.
2. **Prompts are modular.** Each phase has its own prompt file;
   variables are interpolated at call time.
3. **Detail over creativity.** Long, explicit prompts beat short
   evocative ones with `gpt-image-2`. Identity drift is the enemy.
4. **Consistency is the primary success metric.** A great-looking
   image with a different face is a failure.

---

## 2 · Phases

| # | Phase | Doc | Status |
| --- | --- | --- | --- |
| 1 | Base model generation | [phase-1-base-model.md](./phase-1-base-model.md) | Drafted |
| 2 | Garment application | _TBD_ | Pending |
| 3 | Pose transformation | _TBD_ | Pending |
| 4 | Environment generation | _TBD_ | Pending |

The original ChatGPT recommendation that seeded this pipeline —
including the verbatim base prompt, complete filled example, and
all the guidance about how to write the Phase 2-4 prompts — lives
in [source-notes.md](./source-notes.md). Treat that as the canonical
reference when crafting later-phase prompts.

The admin UX for actually running Phase 1 (and eventually Phases
2-4) is documented separately in [model-studio.md](./model-studio.md).

---

## 3 · Future preset combinations

Once all four phases stabilize, the modular system can be combined
into reusable presets. Targets we've discussed:

- **Ecommerce on-white** — Phase 1 + Phase 2 only, neutral pose,
  studio background.
- **Instagram lifestyle** — Phase 1 + 2 + 3 + 4 (café / street /
  interior).
- **Vintage editorial** — Phase 1 + 2 + editorial environment +
  film-grade color treatment.
- **Candid streetwear** — Phase 1 + 2 + casual pose + outdoor
  environment.
- **Luxury fashion** — Phase 1 + 2 + clean studio + editorial
  lighting.
- **Pinterest mood** — Phase 1 + 2 + interior or mirror-selfie
  framing.

Presets aren't documented as separate phases — they're combinations
of phase prompts, configured per-shop or per-product. Worth
revisiting once Phase 2-4 prompts are stable.

---

## 4 · How this connects to the rest of the codebase

- The image worker (`gpt-image-2`) lives in
  `src/lib/integrations/openai/image-placement-worker.ts` and the
  queue is `ai-image-placement`. See
  [../ai-enrichment.md §6](../ai-enrichment.md).
- Base model images for the shop are uploaded to R2 under
  `assets/models/{model_id}/contact-sheet.jpg` (+ cropped derivatives)
  and reused across all products. **Phase 1 is what generates those
  source files** — it is a low-frequency setup step run from the
  [Model Studio](./model-studio.md), not a per-product call.
- Phase 2 is the per-product call: it takes a saved model from the
  Studio library + the product photo and produces the on-model image
  that gets attached to the listing. The model is either picked
  manually on the product form or randomized from `status='active'`
  models.
- Phases 3-4 are optional follow-up calls for social content; they
  are not part of the Etsy publish flow.

---

## 5 · Locked decisions

- Prompts stay in English. The admin UI is Spanish, but every
  prompt sent to OpenAI is English-only (better model performance,
  fewer translation quirks). See
  [../project-conventions.md](../project-conventions.md) §2.
- Variables are documented per phase with explicit example values.
  The interpolation contract (e.g. `{AGE_RANGE}`) is the same as
  the existing prompts in `src/lib/integrations/openai/prompts.ts`.
- No new env vars yet. Once a phase is wired in, the prompt becomes
  the default for a `{PHASE}_PROMPT` env override following the
  same pattern as the enrichment prompts.
