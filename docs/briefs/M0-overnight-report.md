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
