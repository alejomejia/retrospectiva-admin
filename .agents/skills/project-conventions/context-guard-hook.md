# Context Guard Hook

If you write `createContext(…)`, you must also export a `use<Name>Context()`
hook that throws when consumed outside the provider tree. Sub-components and
consumers may only call the guard hook — never `useContext(FooContext)`
directly.

## Why

This codebase has shipped at least one bug caused by a sub-component reading
a nullable context without realizing it was rendered outside the provider.
The symptom was a silent `undefined` deref at runtime, deep inside a
third-party animation callback. A guard hook turns that into a loud, named
error at the exact line of misuse.

It also documents intent: "this component must be rendered inside `<Foo>`"
is a contract, and the throw enforces the contract.

## The Pattern

```ts
// foo.context.ts
import { createContext, useContext } from 'react'

export type FooContextValue = {
  // … real fields, never optional unless meaningful
}

/**
 * Internal context that distributes Foo state to all sub-components without
 * explicit prop threading.
 */
export const FooContext = createContext<FooContextValue | null>(null)

/**
 * Consume FooContext. Throws a descriptive error if called outside of a
 * <Foo> tree, surfacing misuse at development time.
 */
export function useFooContext(): FooContextValue {
  const ctx = useContext(FooContext)
  if (!ctx) {
    throw new Error('Foo sub-components must be rendered inside <Foo>')
  }
  return ctx
}
```

## Rules

1. **Type the context as `T | null`**, not `T | undefined`. `null` is the
   explicit "no provider" sentinel; `undefined` is too easy to confuse with
   "not yet initialized."
2. **`useFooContext` always throws — never falls back to a default.** A
   silent default hides the bug.
3. **The error message names the component pair**: `<Foo> must wrap <Foo.Bar>`
   or `Foo sub-components must be rendered inside <Foo>`. The future you
   debugging this at 1am will thank current you.
4. **Sub-components import `useFooContext`, not `FooContext`.** The bare
   context export should be used only by the provider in `index.tsx`.
5. **Do not re-export `useContext` re-bound** (`export const useFoo = () =>
   useContext(FooContext)`) — that's a context-without-guard, dressed up.

## Common Mistakes

| Mistake | Fix |
|---|---|
| `useContext(FooContext)` called directly in a sub-component | Replace with `useFooContext()`. |
| `useFooContext` returns `T \| null` instead of `T` | The whole point is to narrow — throw on null, return `T`. |
| Default value passed to `createContext({ … })` | Pass `null` and let the hook throw. Defaults make the bug invisible. |
| `useFooContext` defined in a separate file from `FooContext` | Co-locate them in `foo.context.ts`. |

## Verification

A correct context implementation should pass:

```sh
# No bare useContext calls for project contexts in the components tree.
# Matches inside foo.context.ts files are fine; matches anywhere else are bugs.
rg "useContext\(\w+Context\)" src/components/
```
