# Collaboration norms

How Claude sessions should approach work in this project. These rules
exist because each one prevented or fixed a real wasted-effort
incident with the codebase owner. Apply them on every interaction.

The norms are about **process**, not code. They sit alongside the
code-conventions docs in this folder because, in practice, sub-optimal
collaboration ships sub-optimal code.

---

## 1. Don't add features the user didn't ask for

Build exactly what the user describes. If a related feature seems
valuable but wasn't requested — defensive null-checks for cases that
can't happen, "future-proof" abstractions, a `.dark` theme block when
no dark mode was discussed, helpful logging beyond the asked scope —
**propose it as a single sentence before implementing, not bake it
in**.

### Why this exists

During Phase 0 of this scaffold, I (a prior Claude session) added a
`.dark { ... }` overrides block to `globals.css` "in case dark mode
is wanted later." The user pushed back: *"I don't tell you that I'd
like a dark theme feature, so feel free to drop it."* Removing it
forced an unnecessary CSS-variable indirection that conflicted with
the simpler `@theme`-only structure they preferred.

### How to apply

- Build only what the user described. If a tangential thing looks
  valuable, surface it: *"I noticed X — want me to add it, or
  separate concern?"*
- Don't write defensive code for inputs that can't happen given the
  surrounding contract. Trust your callers.
- Avoid "this might be useful later" abstractions. The cost of
  premature flexibility is making the current code harder to read.

### Verifier

If you reach for a feature, dependency, comment, or configuration
that *wasn't named by the user*, stop. Ask first.

---

## 2. Ask first when there are options or doubts

When a problem has multiple reasonable solutions — different
trade-offs, different costs, different shape — **surface the choice
to the user**. Use `AskUserQuestion` to lay out 2–4 options with
their tradeoffs. The user makes the call; you don't make it on their
behalf and justify after.

### Why this exists

Mid-Phase-0, I saw a `border-ink` class wasn't working on a brand
token and inferred the cause (`brand-` prefix). Without asking, I
renamed every brand token to drop the prefix and refactored 7 files
of consumers. The user's actual ask was just: *"how do I use the
brand color?"* — the answer was three words: *"use `border-brand-ink`."*
They reverted the rename and asked me to always ask first.

### How to apply

- When diagnosing an issue, distinguish *what's broken* from *what
  to do about it*. Often the first answer is just an explanation.
- Before any non-trivial refactor you weren't explicitly asked to do,
  propose it as an `AskUserQuestion` with the cost laid out — don't
  ship-then-justify.
- Even small structural choices (prefix yes/no, single file vs split,
  framework option A vs B) get surfaced. The user wants visibility,
  not a *fait accompli*.
- "Diagnose, propose, wait for go-ahead" beats "diagnose and act."

### When NOT to ask

- Mechanical small choices (variable names, exact JSX whitespace,
  comment phrasing) — just decide.
- When the user's last message ended with an unambiguous directive
  ("do X" / "yes, go" / a clear pick from previous options).

---

## 3. Suggest better options proactively

When the user proposes an approach, **evaluate it on its merits and
counter-propose if you see a better path** — *even if their initial
suggestion was clear and reasonable*. They've explicitly invited
pushback.

### Why this exists

The user proposed continuing with WebP for image storage. I started
to implement it; then realized WebP-to-JPEG transcoding would be
required at the Etsy boundary downstream. I should have flagged that
trade-off *before* starting. After we caught it together, the user
said: *"each time I suggest you something, you can let me know about
better options to implement it, don't take my input as a word that
MUST be accomplished in that way. You have more knowledge than me,
so feel free to suggest me stuff that works better."*

### How to apply

- When the user proposes an implementation approach, briefly weigh
  it against alternatives in your head before executing.
  - If their approach is the best one, **say so explicitly**. Low-
    confidence confirmation is informative: *"that's what I'd do too
    — going with it."*
  - If a different approach is meaningfully better — clearer
    trade-off, smaller maintenance surface, better fit for an
    upcoming phase — surface it as a recommendation with a one-line
    *why*, then ask before executing.
- Use `AskUserQuestion` when the choice is a real branch point.
  A short text recommendation is fine for low-stakes ones.
- "Better" means **for this specific project's constraints**:
  2-user shop, self-hosted VPS, Spanish-only admin, vintage clothing
  workflow, eventual Etsy publishing. **Not** "industry best practice
  in the abstract."
- Don't manufacture disagreement. If the user's idea is exactly what
  you'd do, just confirm and execute. The rule is to *not silently
  follow a sub-optimal idea*, not to *invent disagreement*.

### Combines with rule #2

The counter-proposal lives in the same question the user is going
to answer anyway — not in a separate "actually, I did X instead"
after the fact.

---

## How these three rules fit together

```
User asks for X
       │
       ▼
Is X clearly optimal for this project?
   │
   │ Yes ────────► Confirm + execute. Done.
   │
   │ No / unsure
   ▼
Are there multiple reasonable approaches?
   │
   │ Yes ────────► AskUserQuestion with options + tradeoffs.
   │               (Rule 2 + Rule 3)
   │
   │ Only one alternative, but it's clearly better
   ▼
Briefly explain the alternative, ask before executing.
       (Rule 3)
```

In all cases: **don't add anything the user didn't name** (Rule 1).
The rules compose: an unrequested feature added during a "better
option" counter-proposal is still a violation of Rule 1.

---

## What these are NOT

These are *collaboration* norms for Claude, not coding standards.
They don't tell you HOW to write TypeScript or organize files.
The other docs in this folder (`component-pattern.md`,
`consume-env-via-config.md`, etc.) cover that.

If you find yourself in a place where these norms feel restrictive
("but the user obviously wants me to fix everything I see broken"),
re-read Rule 1. The norms are restrictive on purpose; the project
ships better that way.
