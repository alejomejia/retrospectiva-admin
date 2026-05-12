# Component Constants

Component `.tsx` files in this codebase should describe *behavior and JSX*.
Constants — easings, durations, color tokens, class variant tables, magic
numbers — belong in a sibling `<component-name>.const.ts` file.

## Why

- Reading the JSX is faster when you don't have to skip past 30 lines of style tables to find the markup.
- Constants are the unit of design tweaks. Designers will edit `.const.ts` far more often than the JSX. Keep that diff narrow.
- It makes constants importable from sibling sub-components without dragging the JSX file onto the import graph.

## What Counts as a Constant

Move to `<name>.const.ts`:
- Animation timings: `const FADE_IN_MS = 350`
- Easing strings: `const EASE_OUT = 'power3.out'`
- Color tokens used by inline `style` / CSS vars (not Tailwind classes — those stay in JSX)
- Class variant lookup tables: `const VARIANT_STYLES = { default: '…', ghost: '…' }`
- Storage keys, query-param names, route paths
- ARIA strings used in more than one place
- Validation thresholds (`MIN_IMAGES = 13`)

Keep inline:
- One-off literals used in a single JSX expression and unlikely to be tuned.
- Tailwind class strings inside `cn(…)` calls — they're configuration, but
  splitting them across files harms readability more than it helps.

## Example

**Before** (`text/index.tsx`):
```tsx
const variantStyles = {
  display: 'text-7xl font-light tracking-tight',
  heading: 'text-4xl font-medium',
  body: 'text-base font-normal leading-relaxed',
  // … 30 more lines …
}

export function Text({ as = 'p', variant = 'body', children }: TextProps) {
  // …
}
```

**After**:
```ts
// text.const.ts
export const TEXT_VARIANT_STYLES = {
  display: 'text-7xl font-light tracking-tight',
  heading: 'text-4xl font-medium',
  body: 'text-base font-normal leading-relaxed',
  // …
} as const
```

```ts
// text.types.ts
import type { TEXT_VARIANT_STYLES } from './text.const'

export type TextVariant = keyof typeof TEXT_VARIANT_STYLES
```

```tsx
// text/index.tsx
import { TEXT_VARIANT_STYLES } from './text.const'
import type { TextVariant } from './text.types'
```

**Where types live: in `<component-name>.types.ts`, not `<component-name>.const.ts`.**
The `.const.ts` file holds runtime values only. Types derived from those
values (`keyof typeof`, `typeof`, mapped types over a const map, discriminated
unions of literal keys) live next door in `.types.ts` and `import type` from
the const file. Keeping that split disciplined means:

- `.const.ts` stays a value-only module — no surprise type-only re-exports.
- `.types.ts` is the single place a consumer looks for "what shapes does this
  component speak in?"
- A `type` import never accidentally pulls a runtime constant table into a
  bundle when only the type is needed.

Note the `as const` plus the derived `TextVariant` type — that's the
second-order benefit. The variant key set becomes a single-source-of-truth
for both runtime and types, with each living in its dedicated file.
