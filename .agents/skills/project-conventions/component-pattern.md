# Component Pattern

The canonical file layout and export convention for any non-trivial component
in this codebase.

## When to Apply

- Creating a new multi-file component under `src/components/`.
- Refactoring a single-file component that has grown subcomponents, internal state, or its own constants/types.
- Reviewing PRs that introduce or modify components in scope.

### Concrete triggers (apply if ANY are true)

- **≥150 lines** in a single `.tsx` file.
- **≥2 subcomponents** declared in the same file as the root.
- **Custom hook logic** — `useEffect`/`useMemo`/`useCallback`/`useState` cluster
  that drives behavior (drag-and-drop, polling, debounced autosave, form
  orchestration). If you can name the hook (`useSortableGrid`,
  `useStepFooter`, `usePolling`), it deserves its own `use-<name>.ts` file.
- **Module-scoped constants** (preset arrays, label maps, magic numbers) used
  in more than one place inside the file.
- **Compound API surface** — the component exposes multiple named slots
  (`<Foo.Header>`, `<Foo.Body>`).

**Do NOT apply** to:
- Trivial primitives (`Container`, `Grid`, `Button`) — keep as a single file.
- Server Components that are just composition + JSX with no client logic.

## Where the folder lives

The folder replaces the single file **in the same parent directory**.

```
src/components/products/image-list.tsx
  →
src/components/products/image-list/
  ├── index.tsx
  ├── image-list.types.ts
  ├── image-list-tile.tsx
  └── use-image-list.ts
```

Never relocate to a new top-level directory or `components/<category>/<name>/<name>/`. Imports stay stable because the folder is a drop-in replacement: `@/components/products/image-list` resolves to `index.tsx`.

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

## Hook Extraction

Logic-heavy components MUST lift their behavior into a `use-<component-name>.ts` hook. The `.tsx` file becomes a thin shell: props → hook call → JSX. This is the single biggest lever for keeping components scalable.

### What belongs in the hook

- All `useState` / `useReducer` for the component's own model.
- All `useEffect` / `useLayoutEffect` (subscriptions, polling, registrations).
- All `useMemo` / `useCallback` for derived values + stable handlers.
- All `useRef` for DOM refs and mutable scratch state.
- Server-action calls + their `useTransition` wrapping.
- Validation / "can proceed" / "is dirty" boolean derivations.

### What stays in the `.tsx`

- The `Props` destructure.
- The hook call: `const vm = useFoo(props)`.
- JSX — including conditional branches and `vm.items.map(...)`.
- Wiring `onClick={vm.handleX}` — no inline closures that re-derive logic.

### Hook return shape

Return a single named object (a "view model"), not a tuple. Keeps call sites readable and lets you add fields without re-positional-binding callers.

```ts
// good
const { items, isDragging, canSubmit, handleDragEnd, handleSubmit } = useImageList(props)

// bad — order is load-bearing and breaks silently
const [items, handleDragEnd, isDragging] = useImageList(props)
```

### Signal: the hook is doing too much

If the hook itself crosses ~150 lines or owns two unrelated concerns (drag-and-drop AND server persistence AND keyboard shortcuts), split it: `use-foo-drag.ts`, `use-foo-persist.ts`, composed by `use-foo.ts`. One file per concern.

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
| Hooks (`useEffect`, `useState`, server actions) clustered in `.tsx` | Lift into `use-<name>.ts`. The `.tsx` should be a thin shell. |
| `useEffect` doing data fetching, polling, or subscriptions inside `.tsx` | Move to the hook. The component file should not own side-effects. |
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
