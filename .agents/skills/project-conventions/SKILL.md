---
name: project-conventions
description: House code-organization AND collaboration conventions for this project — component file/naming pattern, constants extraction, context guard hooks, env-config access, dev-only logging, and the three norms for how Claude sessions should approach work
user-invocable: false
---

# Project Conventions

How code is organized, named, and structured in this codebase — plus
how Claude sessions should approach work in it. Apply these rules
when writing or reviewing any code in `src/`.

## Collaboration norms (read these first)

Three rules about how to approach work in this repo. They're listed
first because every other convention in this file presumes them.

See [collaboration-norms.md](./collaboration-norms.md) for:

- **Rule 1: Don't add features the user didn't ask for.** Defensive
  code, "future-proof" abstractions, and unrequested helpers don't
  ship — propose first.
- **Rule 2: Ask first when there are options or doubts.** Surface
  branch points via `AskUserQuestion`; don't decide silently and
  justify later.
- **Rule 3: Suggest better options proactively.** When the user's
  proposal isn't optimal *for this project's specific constraints*,
  counter-propose. The user has explicitly invited pushback.

These three exist because each one prevented or fixed a real
wasted-effort incident in this codebase (WebP→JPEG, the
`brand-`-prefix rename, the unrequested `.dark` theme). The
collaboration-norms doc has the incidents documented.

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

## Consuming Environment Variables

Never call `process.env.*` from app code. Read configuration through
`@/lib/utils/config` (server) or `@/lib/utils/public-config` (client).
The whole env is zod-validated at boot, so a missing/malformed value
crashes startup with a single readable error.

See [consume-env-via-config.md](./consume-env-via-config.md) for:
- The fail-fast rationale
- How to add a new variable
- The four sanctioned files that ARE allowed to read `process.env` and
  why
- A one-line grep that verifies the rule

## Dev-Only Logging

For diagnostic logs that should help during development but disappear
in production, use `@/lib/utils/dev` (`devLog` / `devWarn` / `devError`
/ `devGroup(tag)`) — never raw `console.log`. The helpers no-op in
production builds and are tree-shaken to nothing.

See [use-dev-logger.md](./use-dev-logger.md) for:
- The zero-overhead-in-prod mechanism
- The `devGroup("auth")` scoping pattern
- What NOT to log even in dev (passwords, hashes, tokens, PII)
- When to use `toast`/`thrown Error` instead
