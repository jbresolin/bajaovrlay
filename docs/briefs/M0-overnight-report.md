# M0 overnight report — 2026-10-08/09

Three tasks were worked through in order (BAJAOVRLAY-7, BAJAOVRLAY-10, BAJAOVRLAY-8). Each was
done on its own branch with tests written first. Four independent reviewers then checked each
branch (brief compliance, readability law, testing style, correctness), an adversarial verifier
checked their findings, and every confirmed finding was fixed before pushing. The full gate
(lint, typecheck, test, build, e2e) passed locally and in CI on Node 22.23.3 for all three. No
task was blocked.

## Status at a glance

| Task | PR | State | CI |
| --- | --- | --- | --- |
| BAJAOVRLAY-7 scaffold + CI gates | [#1](https://github.com/jbresolin/bajaovrlay/pull/1) | **Squash-merged** to main (allowed by the brief), branch deleted | green |
| BAJAOVRLAY-10 race-clock OGraf graphic | [#2](https://github.com/jbresolin/bajaovrlay/pull/2) | **Open, waiting for your review** | green |
| BAJAOVRLAY-8 server core | [#3](https://github.com/jbresolin/bajaovrlay/pull/3) | **Open, waiting for your review** | green |

## What was built

- **BAJAOVRLAY-7 (on main).** A pnpm 12 workspace: Hono server (`/health`, JSON 404/500 in
  pt-BR, pino logs with `request_id`, serves the built control page and renderer), Vite + React +
  Tailwind v4 control page with a shadcn Button and a pt-BR catalog, framework-free renderer with
  a 1920×1080 transparent stage, `HealthResponseSchema` in `packages/shared`. CI runs every gate
  and uploads Playwright output on failure. `docs/testing-style.md` holds the canonical test; a
  test fails if the guide and the real `/health` test drift apart.
- **BAJAOVRLAY-10 (PR #2).** `packages/graphics/race-clock`: OGraf v1 manifest validated
  against the vendored OGraf JSON Schema, Lit + GSAP component with all six lifecycle methods
  answering status codes instead of throwing, pure modules for model/extrapolation/formatting,
  preview page with `?data=`, 75 unit tests, 14 Playwright tests, six screenshot baselines. The
  baselines rendered on WSL also pass on CI's Chromium within a 1% tolerance.
- **BAJAOVRLAY-8 (PR #3).** State slices, commands and the WS protocol in `packages/shared`.
  `applyCommand` is the single path (validate → authorize hook → pure reducer → one SQLite
  transaction for slices + event-log row → broadcast). It adds committed Drizzle migrations that
  fail closed at boot, a first-boot seed, `/ws` with a 15 s heartbeat, `GET /api/v1/state` with an
  OpenAPI document, and `/graphics/*` static serving. 108 tests across the repo, including real
  SQLite files and a real port.

## What is waiting for you

1. **Review PR #2 and PR #3.** Each description lists where to start reading (tests first), the
   commands to see it working, and its decisions.
2. **Merging both: one trivial conflict.** Both branches append a line to `.prettierignore`;
   keep both lines. `pnpm-lock.yaml` merges cleanly as text, but run
   `pnpm install --frozen-lockfile` after merging the second one to confirm the lockfile.
3. **Confirm the decisions below that change behaviour** (marked ★).

## Decisions taken (full lists are in each PR)

Cross-cutting:

- Local runs used Node 24.15.0 because no Node 22 is installed here, and installing it is your
  call. CI on Node 22 is the proof for all three PRs.
- `@playwright/test` is pinned to exactly 1.62.0 through a pnpm catalog, matching the Chromium
  already cached locally. CI installs that browser once from the root.
- TypeScript ~6.0.3 rather than 7.x, because typescript-eslint does not support 7 yet.
- shadcn files were written by hand from the registry instead of running `shadcn init`, since
  the CLI would download and execute code.

BAJAOVRLAY-10:

- ★ Six screenshots, one per data state, rather than five. `pre` gets a neutral grey band
  labelled **PRÉ-LARGADA**; please confirm the label and colour.
- ★ `load` needs complete data and is called once. `updateAction` before play answers 409.
  Unknown fields answer 400.
- Countdowns drop partial seconds, so a countdown shows 0:00 during its last second.
- Theme values are `var(--baja-*, default)` fallbacks, so a theme set on `:root` reaches the
  graphic. A test proves it.

BAJAOVRLAY-8:

- ★ New instances start as `loading`, since nothing acknowledges a take in M0. `clearLayer` and
  `clearAll` remove instances immediately, and `clearAll` ignores `persistent`.
- ★ `target` defaults to `program`. A take replaces only the same layer and output.
- ★ The eventLog slice broadcasts only the newest 200 entries; the `event_log` table keeps all.
- The actor for WS commands is `operador:<connection id>` until login exists.
- An invalid WS message is answered with an error `commandResult`, not a fifth message type.
- A stored slice that fails its schema stops the boot rather than running on corrupt state.

## What I would change in the briefs

- **BAJAOVRLAY-7:** say `pnpm install --frozen-lockfile` in "Done when"; list `/health` in the
  dev proxy (or move health under `/api/v1`); state the real Node minimum (22.12+, because of
  Vitest and jsdom); say whether "shadcn initialised" may use the CLI, given the no-download rule;
  declare one workspace-wide Playwright version up front.
- **BAJAOVRLAY-10:** resolve five versus six flag states and give `pre` a label; state whether
  `load` may arrive without data or more than once; say where the theme will be set (`:root`,
  stage, or element); add a rule for clearing an optional field (`lapsCompletedByLeader`) in a
  partial update.
- **BAJAOVRLAY-8:** make the better-sqlite3 build-allowlist entry "if needed" (13.x ships
  prebuilt N-API binaries); say whether `clearLayer`/`clearAll` respect `persistent` and `target`;
  say which message carries a protocol error; allow a `PROTOCOL.md` because the WS examples do not
  fit a 15-line README; plan a "register graphics" task, since seeding only runs on an empty
  database, so a database created before race-clock is built never picks it up without deleting
  the file.
- **Across briefs:** BAJAOVRLAY-8 and BAJAOVRLAY-10 both need to know how a graphic is
  identified. PR #3 registers race-clock as `race-clock` (the folder name, matching
  `/graphics/race-clock/`), not its OGraf id `baja-race-clock`. One sentence in Plane page 00
  would settle it.

## Not done / follow-ups

- CI does not block merges on GitHub itself. Branch protection and rulesets return HTTP 403 for
  this private repository on the current plan ("Upgrade to GitHub Pro or make this repository
  public"). Until then "CI blocks merge" is a working rule, not something GitHub enforces.
- No renderer↔server wiring yet. Nothing loads graphics into the renderer or acknowledges takes;
  that is M1 per the briefs.

## M0 closing round — 2026-10-09/10

The last two M0 tasks were worked through in order (BAJAOVRLAY-9, then BAJAOVRLAY-11), each on
its own branch off main, tests committed before the code. Each branch was checked by four
independent reviewers (brief compliance, readability law, testing style, correctness), an
adversarial verifier checked their findings, and the confirmed ones were fixed tests-first before
pushing. Both PRs are open and unmerged, and CI passed on Node 22 on the first run for both.
Local runs were on Node 24, as before.

### Status at a glance

| Task | PR | State | CI |
| --- | --- | --- | --- |
| BAJAOVRLAY-9 renderer | [#4](https://github.com/jbresolin/bajaovrlay/pull/4) | **Open, waiting for your review** | green |
| BAJAOVRLAY-11 control page | [#5](https://github.com/jbresolin/bajaovrlay/pull/5) | **Open, waiting for your review** | green |

### What was built

- **BAJAOVRLAY-9 (PR #4).** `apps/renderer` mirrors the program `instances` slice: layer
  containers in z-order, graphic modules imported from `/graphics/<id>/`, a pure reconciler that
  returns named operations, and a player that runs them through the OGraf lifecycle (one queue per
  layer, layers in parallel). Every hello disposes and rebuilds the stage with
  `skipAnimation: true`. A broken graphic leaves its own layer empty and nothing else. 8 commits;
  7 Vitest files and 3 Playwright files added, plus the `fake-graphic` fixture. On the branch the
  repository has 244 unit tests and 25 renderer browser tests.
- **BAJAOVRLAY-11 (PR #5).** The control page: WebSocket client with `sendCommand`, a Zustand
  store that is the only home of server state, the layer status panel with **Limpar**, the
  hand-written race-clock take form (**Colocar no ar** / **Atualizar**), the two-press **Limpar
  tudo**, the connection badge that disables every action while disconnected, the program monitor
  iframe, and the `Esc` / `Backspace` shortcuts. 6 commits; 11 Vitest files added, `App.test.tsx`
  extended, and 1 Playwright test against the real server. On the branch the repository has 301
  unit tests. The only new runtime dependency is zustand.

### What is waiting for you

1. **Review PR #4 and PR #5.** Each description says which tests to read first, the commands to
   see it working (PR #4 has the wscat/curl lines; PR #5 has the OBS walk-through) and its
   decisions.
2. **Merging both: one conflict.** Both branches append to `docs/decisions.md`; keep both sets of
   lines. A trial merge showed `eslint.config.js` and `pnpm-lock.yaml` merging cleanly as text,
   but run `pnpm install --frozen-lockfile` after the second merge to confirm the lockfile.
3. **After both are merged,** add the one assertion PR #5 skipped: the program monitor iframe
   contains the clock element (`apps/control/e2e/takeAndClear.e2e.ts`; the gap is named in that
   file's header). M0's definition of done is only met once both are in.
4. **Confirm the decisions below that change behaviour** (marked ★).

### Decisions taken (full lists are in each PR and in `docs/decisions.md`)

BAJAOVRLAY-9 (17 decisions):

- ★ A graphic whose module import failed stays failed until the browser source is refreshed.
  Chromium never fetches a failed module address again, so a plain retry cannot work. A retry
  with a unique address (`?retry=<n>`) is possible and was left for you to decide.
- ★ The renderer awaits a graphic's promises with no timeout, so a graphic that never settles
  blocks its own layer until the page is reloaded.
- ★ `cut` stops and disposes the old graphic before loading the new one, so the layer is empty
  while the new one loads. `crossfade` is treated as `cut` in M0, as the brief says.
- A `load` that answers non-2xx, or a lifecycle call that answers no status code at all, is
  treated as a refusal: logged, element removed, layer left empty.
- A refused or failed stop is logged and the graphic is disposed anyway.
- Late hello and a failed `GET /api/v1/state`: the socket is closed and the normal reconnect
  takes over; the stage is not touched.
- The renderer's Playwright run starts the real server on port 5185 with its own SQLite file.

BAJAOVRLAY-11 (19 decisions):

- ★ `sendCommand` resolves only on an ok result and rejects on a refusal, on 5 s without an
  answer, and with no connection. The brief said both `Promise<CommandResult>` and "rejects on
  error result"; the test list won.
- ★ **Atualizar** is a second take, as the brief specifies: the graphic animates in again and the
  clock restarts from the time typed in the form. To change only the flag mid-race the operator
  must first retype the current time. This is an operator hazard until `updateItemFields` exists.
- ★ `Esc` (clear all) works while typing; `Backspace` (clear the clock layer) does not, and is
  also ignored on dropdowns and the switch.
- ★ The reference time accepts minutes past 59 (up to 999:59), so the four-hour enduro is typed
  as 240:00; a time with an hours part (1:00:00) is refused.
- The form refuses an empty session name although the manifest allows one.
- Request ids are a per-page counter (`pedido-1`, …), because `crypto.randomUUID` does not exist
  over plain http on the LAN.
- The control dev server forwards `/render` and `/graphics` to the server, which serves built
  files, so `pnpm build` is needed once before `pnpm dev`.
- Hard-coded UI text in `features/` and `app/` is caught by an ESLint rule; text inside braces
  is not.

### What I would change in the briefs

- **BAJAOVRLAY-9:** the brief names port 8080 while the server's default is 3000; say whether a
  failed import should be retried; say whether `cut` may leave the layer empty while the new
  graphic loads; give lifecycle promises a timeout or say there is none.
- **BAJAOVRLAY-11:** pick one of "`Promise<CommandResult>`" and "rejects on error result"; say
  `pnpm build` is needed once before `pnpm dev`; say whether dropdowns and switches count as
  inputs for `Backspace`.

### Not done / follow-ups

- The two `wscat` lines in PR #4 were not run, because running them means downloading a tool.
  The same `takeGraphic` message was sent from a script against the built server and showed the
  clock, and `e2e/raceClockOnAir.e2e.ts` runs that path on every CI build.
- Every instance reads "carregando" in the layer panel, and the renderer acknowledges nothing,
  until BAJAOVRLAY-12.
- The take form is not filled back in from on-air data after a reload, and no test proves its
  hand-written rules still match `race-clock.ograf.json`. BAJAOVRLAY-14 replaces the form.
- The control bundle is 503 kB (160 kB gzip), just over Vite's 500 kB warning. It is not split.
- `.prettierignore` on main still contains merge-conflict markers from the earlier merge. They
  are harmless to Prettier and were left alone as outside both tasks; it is a one-line cleanup.
- Root `pnpm test:e2e` takes about 7 minutes on this machine although the tests take seconds
  (Playwright's first probe of a closed port is slow under `pnpm --recursive`). It predates this
  round, does not happen on CI (about 2 minutes for the whole job), and was not investigated.
