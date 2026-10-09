# Agent brief — BAJAOVRLAY-7: repo scaffold, CLAUDE.md, CI gates

**Branch:** `BAJAOVRLAY-7-scaffold` off `main`. One PR. This task may be squash-merged by
the agent itself once CI is green (João's standing exception for this item only, because
every other M0 item depends on it). Delete the branch on merge.

**Design authority:** `CLAUDE.md` (read it first and follow it) and Plane page 00
(summarised in CLAUDE.md).

## Deliverable

A pnpm monorepo where every package builds, lints, typechecks and has at least one real
test, and CI blocks on all of it. No features yet — only enough running code in each app
to prove the toolchain end to end.

## Layout (create exactly this)

- `apps/server` — Hono on Node 22 with `ws`. Boots, logs structured JSON, answers
  `GET /health` with `{ ok: true, version }`. Serves `apps/control/dist` at `/` and
  `apps/renderer/dist` at `/render` when those folders exist. No state store yet
  (that is BAJAOVRLAY-8).
- `apps/control` — Vite + React + TypeScript + Tailwind + shadcn/ui initialised (Button
  only), renders a page titled "BajaOvrLay" with one Button. react-hook-form and zod
  installed. Vite dev proxy for `/api` and `/ws` to the server.
- `apps/renderer` — Vite, no framework. `index.html` with a 1920×1080 transparent stage
  and `src/renderer.ts` that logs "renderer ready". Playwright installed with one test
  that opens the page and asserts the stage exists.
- `packages/shared` — Zod + TypeScript. One schema to prove the pattern:
  `HealthResponseSchema`, used by the server route and by a control-page fetch.
- `packages/graphics/README.md` only (first graphic is BAJAOVRLAY-10).
- `docs/README.md` already exists; add `docs/testing-style.md` containing the complete
  example test file described under Tests.
- Root: `pnpm-workspace.yaml`, `package.json` with scripts `dev`, `build`, `lint`,
  `typecheck`, `test`, `test:e2e`; `tsconfig.base.json` (strict, ESM, NodeNext);
  `.nvmrc` = 22; `.editorconfig`; `.gitignore`; `.env.example`;
  `.github/workflows/ci.yml`.

## Tooling rules

- ESLint flat config + Prettier. Rules: `no-console` error (the server uses its logger),
  `@typescript-eslint/no-explicit-any` error, import ordering, max 400 lines per file as
  a warning.
- Vitest at the root with a workspace covering every package; jsdom + Testing Library
  for `apps/control`.
- CI: on PR and on push to main — install with frozen lockfile, lint, typecheck, test,
  build, Playwright test for the renderer. Cache pnpm. Fail on any step.
- Every package has a 5–15 line `README.md`: what lives here, where to start reading.

## Tests (the review artefact — write these first)

- `packages/shared`: HealthResponseSchema accepts a valid payload and rejects a missing
  field, with the failure message naming the field.
- `apps/server`: `/health` returns 200 and a body that passes HealthResponseSchema; an
  unknown route returns 404 JSON, not HTML.
- `apps/control`: the page renders the title and the button.
- `apps/renderer`: Playwright smoke test above.
- `docs/testing-style.md` is the `/health` test written as the canonical example of the
  beginner-readable style: plain-language file header, a one-line comment above each of
  arrange / act / assert, realistic data, assertion messages that state the expectation.
  Every later test in the repo copies this shape.

## Done when

`pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
all pass locally and in CI; PR description lists the commands João can run to see it
work (`pnpm dev`, open the control page, open `/health`). Then squash-merge, delete the
branch, pull main, and continue to the next brief.
