# `new-product/`

The 2-step "new product" flow used at `/products/[id]`. Wraps every input the
operator touches on a draft listing — manual fields, media, AI-generated
content review, and the publish actions in the always-visible right rail.

Entry point: `new-product-stepper/` → `NewProductStepper`.

---

## 1. The flow

| Step | URL              | Component       | What happens                                                                                                                              |
|------|------------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| 1    | `?step=inputs` *(default — no param)* | `Step1Inputs`   | Operator fills garment type, condition, sizes, prices, measurements, comments, uploads media. |
| 2    | `?step=ai`       | `Step2AiReview` | After **Next**, an `ai-enrich` job runs (title / description / tags / materials). Skeletons show until polling sees `succeeded`; failure surfaces a retry banner. Each field is editable + regenerable in-place. |

The `PublishSidebar` (right rail) is visible on every step. Its three actions
— **Publish now** / **Save draft** / **Schedule** — all flush autosave first
then dispatch the corresponding server action. There is no separate "preview"
or "publish" step: the user reviews the final values directly on step 2 and
fires the publish action from the sidebar.

Step state lives in the URL (`?step=…`) so back/forward and refresh work
naturally. There is no "save between steps" — every field autosaves on change
through the autosave context.

---

## 2. File layout

The folder follows
[`.agents/skills/project-conventions/component-pattern.md`](../../../../.agents/skills/project-conventions/component-pattern.md):
each non-trivial component owns a kebab-cased subfolder with a thin `index.tsx`
shell, a `use-<name>.ts` hook, and sibling sub-component files prefixed with
the parent name. The prefix makes cmd+P deterministic — type `step-1-inputs-`
and you get every part of that component.

```
new-product/
├── new-product-stepper/          # Root orchestrator (URL state, layout)
│   ├── index.tsx                 # NewProductStepper — thin shell
│   ├── use-new-product-stepper.ts
│   ├── new-product-stepper.const.ts   # STEP_ORDER, parseStep, StepKey
│   └── new-product-stepper-footer.tsx # Sticky prev/next bar
│
├── step-1-inputs/                # Step 1 — manual fields
│   ├── index.tsx
│   ├── use-step-1-inputs.ts      # All local state, beforeNext, register
│   └── step-1-inputs.const.ts    # missingFieldList()
│
├── step-2-ai-review/             # Step 2 — AI enrich review
│   ├── index.tsx
│   ├── use-step-2-ai-review.ts   # Polling glue, kick, timeout
│   ├── step-2-ai-review.const.ts # POLL_TIMEOUT_MS, derivePhase(), Phase
│   ├── step-2-ai-review-running-skeleton.tsx
│   └── step-2-ai-review-failure-banner.tsx
│
├── publish-sidebar/              # Right rail — terminal actions
│   ├── index.tsx
│   └── use-publish-sidebar.ts    # save/schedule/publish transitions
│
├── schedule-picker/              # Date + time picker for the Schedule action
│   ├── index.tsx
│   ├── use-schedule-picker.ts
│   └── schedule-picker.const.ts  # Re-exports lead-time bounds
│
├── measurements-field/           # Per-garment-type measurement inputs
│   ├── index.tsx
│   ├── measurements-field-cm-input.tsx
│   └── measurements-field-bra-size-input.tsx
│
├── autosave/                     # Debounced per-field autosave context
│   ├── index.tsx                 # AutosaveProvider + re-export useAutosave
│   ├── autosave.context.ts       # createContext + useAutosave guard hook
│   ├── use-autosave-provider.ts  # Patch buffer + flush + debounce + coalescing
│   ├── autosave.types.ts         # AutosaveStatus, AutosaveContextValue
│   └── autosave.const.ts         # DEBOUNCE_MS (500ms), dev logger
│
├── step-footer-context.tsx       # Tiny shared state for the footer's canNext / beforeNext / disabledReason
├── autosave-indicator.tsx        # The "Guardado hace 3s" pill in the stepper header
│
├── buy-price-field.tsx           # Buy-price (cost basis) input
├── condition-field.tsx           # Used / Like-new / etc. select
├── garment-type-field.tsx        # The clothing-type select — drives required measurements
├── price-field.tsx               # Base price + markup-override pair
└── sizes-field.tsx               # Multi-select XS/S/M/L/…
```

Components below the component-pattern triggers (≤150 lines, no clusters, no
internal subs) stay as flat files. Everything else lives in a folder.

---

## 3. Two contexts you need to know about

### `autosave/` — `useAutosave()`

Wraps the whole stepper. Every editable field calls `schedule(patch)` on
change; the provider coalesces patches across a **500ms debounce**, then
fires a single `updateProductDraftField(productId, patch)` server action.
Concurrent calls coalesce: if a save is in flight when a new patch arrives,
the next patch waits for it. On failure the patch is restored to the buffer
so the next flush retries.

`flush()` forces an immediate save and resolves `true` on success. The footer's
**Next** button and the publish-sidebar actions all `await flush()` before
their server actions to avoid losing pending edits at a step boundary.

Status flows: `idle → saving → saved`, or `→ error` on failure. The
`AutosaveIndicator` reads this and renders the pill in the stepper header.

### `step-footer-context.tsx` — `useStepFooter()`

A minimal "the current step wants to tell the footer something" channel.
Each step component calls `register({ canNext, disabledReason?, beforeNext? })`
inside a `useEffect`. The footer reads `state` and:

- Disables **Next** if `canNext` is false (showing `disabledReason` if present).
- On click, awaits `beforeNext()` first (e.g. step 1 flushes autosave and
  enqueues the AI enrich job). If it returns `false`, navigation is cancelled.

Step 2 uses this to block **Next** while the enrich job is `running` — but
since step 2 is the last step, this only matters if a future step is added.

---

## 4. Polling

- **Step 2 enrich**: `useAiStatusPolling(productId)` (from
  `@/components/products/use-ai-status-polling`) polls every ~2.5s. Phase is
  fully derived (no `setState`-in-effect) via `derivePhase()` —
  `kickedAt` is used to ignore stale `finishedAt` values so the UI flips back
  to **running** the instant the user clicks **Regenerar** / **Retry**.

The polling hook lives outside this folder (under `src/components/products/`)
because the flat edit form needs it too.

---

## 5. External consumers

The folder is consumed in three places. Only the listed paths are public —
nothing else should be imported from inside the subfolders.

| Importer | What it imports |
|---|---|
| `src/app/(admin)/products/[id]/page.tsx` | `NewProductStepper` |
| `src/components/products/edit-form.tsx` | `AutosaveProvider`, `AutosaveIndicator`, the 6 field components (`ConditionField`, `GarmentTypeField`, `MeasurementsField`, `BuyPriceField`, `PriceField`, `SizesField`) |
| `src/components/products/edit-form/ai-content-section.tsx` | `useAutosave` |

Because every compound-root folder ships an `index.tsx`, the import paths are
`@/components/forms/new-product/<name>` — the folder is a drop-in replacement
for the flat file it replaced.

---

## 7. Conventions when extending

- New non-trivial component (≥150 LoC OR ≥2 inline subs OR a real hook
  cluster OR module-scoped constants used in >1 place) → create a folder, not
  a flat file. Follow the layout above.
- New trivial primitive (one input, light state, ≤150 LoC) → flat file is
  fine. Don't pre-emptively split.
- Keep `index.tsx` thin: props destructure → `useFoo(props)` → JSX. If you
  catch yourself writing a `useEffect` in `index.tsx`, lift it into the hook.
- File names are kebab-case, **prefixed with the parent folder name** so
  cmd+P stays deterministic. `measurements-field-cm-input.tsx`, not
  `cm-input.tsx`.
- `.context.ts` is `.ts` (no JSX). The provider component lives in
  `index.tsx` or a `<name>-provider.tsx` sibling.
- `cn()` comes from `@/lib/utils/helpers`. Never import `clsx` directly.
- All UI strings are English via `m.*` from `@/lib/i18n/messages.en`;
  the ES → EN translation happens at the Etsy-publish boundary, not here.
- Don't add public compound API (`Object.assign(Root, { Sub })`) here unless
  the sub-component is meaningfully callable from outside the folder. The
  current subs are private implementation details.

---

## 8. Gotchas

- **`BuyPriceField` is remounted via `key={`buy-${clothingType}`}`** in
  `Step1Inputs`. That's intentional: changing the garment type overwrites the
  per-product buy price with the type's default, and remounting resets the
  field's local text buffer to reflect the new default.
- **`STEP_1_REQUIRED`** from `draft-schema` is intentionally referenced via
  `void STEP_1_REQUIRED` in `step-1-inputs.const.ts` — it documents the
  keep-in-sync intent between the client validator and the schema source of
  truth.
- **Step 2 uses `key={product.updatedAt.getTime()}`** on `AiContentSection`
  so it re-mounts (re-seeds its local state) after a successful enrich /
  regenerate.
- **`router.refresh()`** is called exactly once per enrich phase transition to
  `succeeded`. Adding more refresh sites is almost always wrong — debug by
  inspecting polling cadence first.
- The publish sidebar's **Schedule** button is gated on
  `etsyPoliciesConfigured`; the warning toast in `useNewProductStepper`
  surfaces the same constraint at the top level.
