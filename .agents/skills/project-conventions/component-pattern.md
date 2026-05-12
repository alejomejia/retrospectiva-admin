# Component Pattern

The canonical file layout and export convention for any non-trivial component
in this codebase.

## When to Apply

- Creating a new multi-file component under `src/components/`.
- Refactoring a single-file component that has grown subcomponents, internal state, or its own constants/types.
- Reviewing PRs that introduce or modify components in scope.

**Do NOT apply** to:
- Trivial primitives (`Container`, `Grid`, `Button`) — keep them as a single
  file.

## File Layout

```
<component-name>/
├── index.tsx                    # Compound root — Object.assign(Root, { Sub })
├── <component-name>.types.ts    # Shared TypeScript interfaces only
├── <component-name>.const.ts    # Module-scoped constants
├── <component-name>.context.ts  # createContext + use<Name>Context guard hook
├── use-<component-name>.ts      # Primary custom hook (DOM refs, animation, etc.)
└── <component-name>-<sub>.tsx   # One file per named sub-component
```

Rules:
- File names are **kebab-case**, always.
- The `<component-name>` prefix is repeated on every sibling file. This makes
  Cmd-P / fuzzy navigation deterministic and prevents `index.ts`-soup.
- A `.context.ts` file is `.ts` (not `.tsx`) when it contains no JSX. If you
  catch yourself naming it `.context.tsx`, the JSX you've put there belongs
  in a `<component-name>-provider.tsx` instead.

## Compound Export

```tsx
// index.tsx
function FooRoot({ children, ...props }: FooProps) { /* … */ }

export const Foo = Object.assign(FooRoot, {
  Bar: FooBar,
  Baz: FooBaz,
})

export type * from './foo.types'
```

- **Always `Object.assign`** — never a plain object literal `{ Root, Bar }`.
  Plain objects break tree-shaking and break the natural `<Foo.Bar>` JSX
  call.
- **Never re-export sub-components individually** after the `Object.assign`.
  The compound surface is the canonical API; named exports compete with it
  and create import-style ambiguity.

## Imports

- `cn()` and `toCSSVars()` come from `@/lib/utils/helpers` — never import
  `clsx` directly.
- `'use client'` only on files that genuinely need it. The compound root
  often *doesn't* — push the directive down to the leaf that uses
  hooks/refs.

## JSDoc

Every exported component, hook, and helper carries:
- A one-line summary.
- `@example` showing realistic JSX usage.
- `@param` for non-obvious arguments.
- `@throws` if there's any runtime invariant (see
  `cinema-scroll-marquee.tsx` for an exemplar — three `@throws` blocks).

## Common Failure Modes

| Smell | Fix |
|---|---|
| `index.tsx` is 200+ lines | Extract sub-components into `<name>-<sub>.tsx`. |
| Magic strings / easings / class variant tables inline in `.tsx` | Move to `<name>.const.ts`. See [component-constants.md](./component-constants.md). |
| `*.context.tsx` with no JSX | Rename to `*.context.ts`. |
| Plain object compound export `{ Root, Sub }` | Replace with `Object.assign(Root, { Sub })`. |
| Sub-component imported via barrel after `Object.assign` | Delete the barrel — the compound API is the only surface. |
| Hybrid `Object.assign` + named exports for the same surface | Pick one. Pick compound. |

## Verification

After applying this pattern to a component, the following greps should
return nothing for that directory:

```sh
rg "useContext\(\w+Context\)" <dir>     # must use guard hook instead
rg "from 'clsx'" <dir>                   # must go through cn()
```
