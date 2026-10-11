# BajaOvrLay — agent contract

BajaOvrLay is a stream-graphics system for Baja SAE Brasil live streams: an operator
control page (apps/control), a Node server that owns all state (apps/server), a
renderer page loaded by OBS (apps/renderer), and OGraf graphics (packages/graphics).
The design authority is docs/00-concept.md. The repo file is authoritative between
milestones, and as-built changes are written into it in the PR that makes them. The
Plane page "00 — Concept & Architecture" (BAJAOVRLAY project, `personal` workspace) is
the human-readable mirror, which João updates from the repo copy at each milestone
close. The parts an agent needs are restated here: stack (§10), architecture
(§3, §6), state model and commands (§4), layout (§11), readability law (§12) and
testing policy (§13). The decision records §18 and §19 win over everything before them.

The person reviewing this code is not its author, reviews mostly by reading the tests,
and will not have an IDE open. Every rule below follows from that.

## Stack (fixed — do not substitute)

- TypeScript strict, Node 22 LTS, ESM (`"type": "module"`, NodeNext), pnpm workspaces.
- Server: Hono + `ws`, Drizzle ORM on better-sqlite3 (SQLite). Zod at every boundary.
  REST under `/api/v1` with OpenAPI generated from the Zod schemas.
- Control page: Vite + React, shadcn/ui with semantic design tokens only,
  react-hook-form + Zod, Zustand for the WebSocket-fed store, dnd-kit for reordering.
- Renderer: framework-free TypeScript. Every dependency there is a frame-drop risk in OBS.
- Graphics: EBU OGraf v1 packages (manifest + web component). Lit for the components,
  GSAP for animation, CSS custom properties for theme values.
- Tests: Vitest (unit, integration with a real SQLite file, components with Testing
  Library), Playwright (renderer, E2E, screenshots).
- Logging: structured JSON logger with `request_id`. `console.log` is lint-banned.
- Language: pt-BR for every user-facing string (operator UI and on-air graphics).
  No hard-coded UI strings; everything goes through the pt-BR catalog.

## Architecture rules

1. The server owns the truth. Clients never hold state of their own: they send
   commands and receive state slices over WebSocket. A page refresh loses nothing.
2. A command is the only way state changes: validate → authorize → apply (pure
   reducer) → persist → event log → broadcast, in that order, in one code path.
3. Graphics receive resolved data only and never fetch anything themselves.
4. A data source failure keeps the last good snapshot and marks it stale. Nothing on
   air is ever blanked by a failure.
5. Transforms on bound data are a registry of named pure functions, never free-form
   expressions.

## Repository layout

```
apps/server/src/core/<concept>/      store, db, ws, logger, env, events
apps/server/src/modules/<name>/      schema.ts service.ts api.ts index.ts README.md
apps/server/src/api/v1/              thin Hono routes: parse → authorize → call module
apps/control/src/features/<name>/    components + hooks per feature
apps/control/src/state/              WS client + store (only place server state lives)
apps/renderer/src/                   renderer.ts and helpers
packages/shared/src/                 Zod schemas, types, WS protocol, commands
packages/graphics/<name>/            one OGraf package: manifest, src, preview.html, tests
docs/
```

Cross-module imports go through the module's `index.ts` only.

## Readability law (merge criterion)

- Naming: names are sentences with the vowels left in. `resolveItemFieldsIntoGraphicData`,
  not `resolve`; `isStale`, not `st`. Booleans read as questions. Functions are verbs,
  data is nouns. Abbreviations only for shared domain terms (OBS, WS, OGraf).
- Files: one responsibility per file and the filename says which. Target 80–300 lines;
  over 400 means a second responsibility moved in. No `utils.ts` / `helpers.ts`
  grab-bags — generic helpers get a named home (`lapTimes.ts`, `ordering.ts`).
- Folders: folder = feature or concept, never `types/`, `hooks/`, `services/` dumping
  grounds. Every package and every module folder has a 5–15 line README.md saying what
  lives there and where to start reading.
- Comments explain why and what could go wrong, not what the line does. Every exported
  function has a 1–3 line doc comment. Deliberate trade-offs are written next to the
  code, not in the PR.
- Cleverness budget: zero. No conditional-type gymnastics, no generic abstraction with
  one call site, no metaprogramming, no clever one-liners. If a reviewer would need to
  run it in their head, rewrite it as steps with named intermediates.
- Public surface: each module's `index.ts` lists what it exports with a one-line
  comment each.

## Testing policy (the review artefact)

Write the tests first. A PR is reviewed by reading its tests; if the tests do not
explain the behaviour on their own, the PR is incomplete.

Every test file follows `docs/testing-style.md` exactly:

- A plain-language header: what this module is for, what these tests prove, what they
  deliberately do not cover.
- Sentence-style test names (`it('keeps the stale snapshot when the poll fails')`).
- Arrange / act / assert separated by blank lines, each with a one-line comment in
  everyday words saying what is being set up, done and checked — even when obvious.
  Assume the reader has never seen a test before.
- Table-driven scenarios are named and have a comment per row saying why that row exists.
- Test data reads like the real thing (`team 42, "Baja UFPR"`), never `foo`/`bar`/`x1`.
- Assertions carry the expectation in the message:
  `expect(result, 'the leader must be first after the pit stop').toEqual(...)`.
- Factories are named for what they build. No clever generation, no shared mutable state.

A flaky test is a bug: quarantine visibly with a comment and a ticket, never delete to
green. CI blocks merge on lint, typecheck or any test failure.

## Git and process

- Branch `BAJAOVRLAY-<n>-<slug>` off `main`; one task = one PR; squash merge; delete
  the branch on merge. Never stack a branch on another unmerged branch.
- Never commit real env values; `.env.example` documents every variable.
- A task brief lives in the Plane work item. If it is also pasted into the session,
  the pasted copy is the one to follow. Decisions the brief flags for João are not
  yours to make: pick the conservative option, state it in the PR description under
  "Decisions taken", and move on.
- Do not merge your own PR unless the brief for that task explicitly says so.
- The PR description lists: what was built, the commands João can run to see it
  working, decisions taken, and anything left out and why.
- Every PR that records a decision also appends it to docs/decisions.md: one line,
  newest at the bottom, with the date, the PR number and the decision in one sentence.

## When unsure

Prefer the plainer design. Prefer fewer dependencies. Prefer a longer, obvious function
over a short, clever one. Ask in the PR description rather than guessing silently.
