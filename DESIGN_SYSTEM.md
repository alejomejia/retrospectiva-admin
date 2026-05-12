# Retrospectiva — Design System

Source of truth for every UI surface in this admin panel. If a screen needs a
color, a font, or a shape that isn't here, **don't invent one** — propose an
addition here first.

The visual source is `design-system.html` at the repo root (Claude Design
output). This document is the codified version, translated into:

- **Tailwind v4 `@theme` tokens** in `src/app/globals.css`
- **shadcn semantic roles** mapped onto the brand palette
- **`next/font/google`** loading the type stack in `src/app/layout.tsx`

## 1. Palette

| Brand name | Hex | Role |
| --- | --- | --- |
| `brand-cream` | `#f7f3e7` | `--background`, primary CTA text |
| `brand-paper` | `#ece5d0` | `--muted`, deeper-cream surface |
| `brand-bone` | `#fbf9f1` | `--card`, `--popover`, `--input` |
| `brand-ink` | `#2a2a25` | `--foreground` |
| `brand-olive` | `#5d6344` | `--secondary` |
| `brand-olive-dim` | `#7a7e5f` | softer olive |
| `brand-olive-deep` | `#3f4530` | `--muted-foreground`, dark surface |
| `brand-terracotta` | `#a6461b` | `--primary`, `--ring` |
| `brand-terracotta-deep` | `#7e3414` | `--destructive`, primary hover |
| `brand-mustard` | `#d4a44f` | `--accent` |
| `brand-mustard-soft` | `#e8c989` | dark-surface accent |
| `brand-rule` | `rgba(42,42,37,.18)` | `--border` |
| `brand-rule-soft` | `rgba(42,42,37,.10)` | dotted dividers |

**Use semantic tokens for everything functional.** Reach for the
`bg-brand-*` utilities only when a decorative surface needs a specific brand
color regardless of role (e.g. the palette swatches in the placeholder page,
a status pill that always means "sold").

## 2. Typography

> **Hard rule:** DM Sans only for sans-serif. No Inter, no Fraunces, no
> system serif fallbacks for body or display.

| Token | Family | Use |
| --- | --- | --- |
| `--font-sans` | **DM Sans** (400/500/600/700, opt-size 9–40) | display + body + UI |
| `--font-mono` | **DM Mono** (400/500) | uppercase tracked labels, data, tags |
| `--font-script` | **Caveat** (400/500/600) | accent only — quotes, signatures |

Type scale (mirrors `design-system.html`):

| Use | Size | Weight | Notes |
| --- | --- | --- | --- |
| Hero | `clamp(72px, 9vw, 132px)` | 400 | tracking `-0.02em`, line-height `0.92` |
| Section h2 | 56px | 400 | line-height 1 |
| Card title (`CardTitle`) | 20–22px | 500 | |
| Body | 15–16px | 400 | line-height 1.55 |
| Caplet label (`.text-caplet`) | 11px | 500 mono | uppercase, tracking `.12em`, olive-deep |

The `.text-caplet` utility is the tiny uppercase receipt-style label used on
form fields, table headers, and tag pills throughout the design.

## 3. Shape

- **Buttons:** pill (`rounded-full`). Default = terracotta on cream. Hover
  shifts to `terracotta-deep`. Secondary = olive on cream. Ghost = ink
  border, inverts on hover.
- **Inputs:** 4px radius, `--input` border, `bg-card` surface, focus
  changes border to terracotta and background to pure white.
- **Cards / frames:** 6px radius, `--border` outline, `bg-card` (bone).
- **"Screens" / large surfaces:** 8px radius, soft shadow
  `0 24px 60px rgba(42,42,37,.08)`.
- **Tags / badges:** 4px radius, mono label.

## 4. Atmosphere

Two subtle effects from the source — both opt-in by adding `class="brand-paper"`
to the `<html>` (already set in `app/layout.tsx`).

1. **Radial color wash** — terracotta top-left + olive bottom-right, each at
   ~5% opacity. Fixed attachment so it doesn't scroll.
2. **Paper grain** — a tiny SVG `feTurbulence` noise overlay at 35%
   opacity, `mix-blend-mode: multiply`. Sits on `body::before` with
   `pointer-events: none`.

**Opt out** for data-dense screens (tables with many rows, the dashboard's
chart area) by wrapping in a container with `class="bg-background"` and
overriding the `::before` to `opacity: 0`.

## 5. Voice & tone

Pulled from the brand sheet. Keep this lens for AI-generated descriptions
and for any user-facing copy in the admin:

- **Warm, specific, and quiet.** Vintage = stories. Skip salesy verbs.
- **Concrete details over adjectives.** Say "1970s Italian wool" before
  "beautiful and unique."
- **Italics for emphasis, sparingly.** The source uses display italic for
  hero accents and pull-quotes only.
- **DO** describe fabric, era, condition, and one human detail.
- **DON'T** capitalize for emphasis, use exclamation points, or stack
  more than two adjectives.

## 6. Component conventions

- **All UI primitives come from shadcn** (`pnpm dlx shadcn@latest add <name>`).
  Don't hand-roll a button. If shadcn doesn't have it, document the
  reasoning here before adding a custom one.
- Tremor (Tremor Raw, copy-paste) is the chart library. Lives under
  `src/components/ui/charts/` when we get to Phase 8.
- Form pattern: `react-hook-form` + `zod` + the shadcn `Form` wrapper.
  Server Actions consume the same zod schema as the client (single source
  of truth for validation).
- Icons: `lucide-react` (shadcn's default).
- Toasts: shadcn `sonner` (Toaster mounted in `app/layout.tsx`).

## 7. Open items

- A short "do" / "don't" example for every voice rule, with screenshots —
  worth doing once the AI description prompt is dialed in.
- Tag/badge variants: `condition`, `size`, `era`, `new`, `sold` from the
  source need to be added as variants on shadcn `Badge` (Phase 2).
