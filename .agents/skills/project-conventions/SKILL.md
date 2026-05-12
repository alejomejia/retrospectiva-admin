---
name: project-conventions
description: House code-organization conventions for this project — component file/naming pattern, constants extraction and context guard hooks
user-invocable: false
---

# Project Conventions

How code is organized, named, and structured in this codebase. Apply these rules
when writing or reviewing any code in `src/`.

## Component Pattern

The canonical multi-file component layout: `index.tsx` (compound root via
`Object.assign`), `<name>.types.ts`, `<name>.const.ts`, `<name>.context.ts`,
`use-<name>.ts`, `<name>-<sub>.tsx` per subcomponent.

See [component-pattern.md](./component-pattern.md) for:
- File layout and naming
- The `Object.assign(Root, { Sub })` compound export
- When to apply (multi-file components) vs. when not (primitives, vendored
  code, intentionally split server/client layouts like `footer/`)
- Verification greps

## Component Constants

Magic numbers, easings, durations, color tokens used in inline styles, and
class variant tables belong in a sibling `<name>.const.ts` file — never
inlined in the `.tsx`.

See [component-constants.md](./component-constants.md) for:
- What counts as a constant vs. what stays inline
- The `as const` + derived-type idiom
- Canonical violations to fix first (`text/`, `skeleton/`, `preloader/`)

## Context Guard Hook

Every `createContext` export must be paired with a `use<Name>Context()` hook
that throws when consumed outside the provider. Sub-components only ever call
the guard hook, never `useContext` directly.

See [context-guard-hook.md](./context-guard-hook.md) for:
- The `T | null` typing rule
- The required throw + descriptive error message
- Why "context with default value" is an anti-pattern here
- Verification greps
