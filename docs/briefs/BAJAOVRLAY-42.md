# Agent brief — BAJAOVRLAY-42: bring CI back under 12 minutes, and `pnpm verify`

> Copied from the first comment on the Plane work item, with the correction from the latest
> comment applied: branch protection is not available for this private repository on its
> current GitHub plan, so the "merge gate" hard rule and the PR's branch-protection note are
> replaced by the `ci-passed` rule below.

**Branch:** `BAJAOVRLAY-42-faster-ci` off an up-to-date `main` (after PR #22).
One PR, left open for João's review. Do not merge. Measure before you change anything, keep
going without asking, and where this brief leaves a choice open take the plainer option,
write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**Read first:**

* `CLAUDE.md`;
* `docs/testing-style.md`;
* `docs/decisions.md`: every line about CI, timeouts, e2e ports and simulator speed;
* `.github/workflows/ci.yml`;
* the root `vitest.config.ts` and each package's `vitest.config.ts` and `playwright.config.ts`;
* `apps/control/e2e/README.md` and `emptyTheServerState.ts`;
* `scripts/` (the e2e port-offset helper and its test).

## Why

CI went from about 11 minutes to about 26 (run of 32a2e20, PR #22). Every gate-2 round waits
on it, and every minute is billed (the repository is private). The job runs on a 2-core
runner.

## Where the time goes today (measured on 32a2e20; re-measure, don't trust this)

| Step | Time |
| --- | --- |
| Setup + install | 0:24 |
| Lint | 0:50 |
| Typecheck | 0:58 |
| **Vitest** | **12:15** |
| Build | 0:15 |
| Playwright browser install | 0:24 |
| **Playwright** (5 packages, one at a time) | **11:11** |

**Vitest** (reproduced on a 2-core machine): 566 files and 4 465 tests, taking 676 s of wall
time but only about 240 s inside tests.

* `apps/control` alone is 464 s: "tests 43%, environment 30%, import 14%, transform 7%,
  setup 7%".
* Vitest itself reports: "jsdom was created 196 times · 130 s… create it once per worker with
  pool: 'vmThreads' (keeps per-file isolation) or isolate: false".
* The slowest files:
  * `DataSourcesPageFlexTest` (13 s), `DataSourcesPageFlexForm` (10 s);
  * the `ItemEditorPanel*` family (3–9 s each, about 15 files).
* Single tests at around 2 s are typing-heavy (`userEvent.type` into long forms).

**Playwright:** `apps/control` runs about 36 specs with `workers: 1` against one real server.

* Several tests wait on a simulated race in real time (`test.setTimeout(180_000)` in
  `towerFollowsTheSimulator` and `bindingsFollowTheSimulator`).
* `page.waitForTimeout` appears in `clockStoppedOnAir`, `rundownTakeWithSpace`,
  `takeAndClear`, `macroStopDuringWait` and `dataSourcesPageStaysResponsive`.

## Hard rules

* **No test is deleted, skipped, weakened or merged away.** The PR reports test counts before
  and after for Vitest and for each Playwright package, and they are equal (or higher).
  Changing *how* a test waits is fine as long as it still proves the same thing. Say so in
  the test's comment.
* **No retries.** Retries stay at 0, and the rule "a flaky test is a bug" stands.
  * Any test made faster must pass 5 consecutive local runs of its file. Report this.
  * Parallel runs must not share a server, a database file, a data folder or a port.
* **Billed minutes must not go up.** If you split the job, the sum of all jobs' minutes per
  run must be at or below today's (about 27). Report both numbers.
* **One line for the merge decision.** Branch protection is not available for this private
  repository on its current GitHub plan, so there is no required check to change. If you
  split CI into several jobs, still add a final `ci-passed` job that `needs:` all of them, so
  a PR shows one green or red line. João merges only on a green `ci-passed`.
* **No new dependencies** unless a measurement shows one is needed. `happy-dom` instead of
  jsdom is **out**: it changes what the component tests prove.

## Deliverable

### A. Profile first (commit 2, docs and scripts only)

`scripts/reportSlowestTests.js` reads Vitest's JSON report and Playwright's JSON report. It
prints the 15 slowest files and tests in a small markdown table. CI appends that table to
`$GITHUB_STEP_SUMMARY`, so a slowdown is visible on every run without downloading logs.

Write the baseline numbers (per step, per package) into the PR description.

### B. Vitest (target: 4 minutes or less on CI)

Try these in order, measuring each:

1. **Pool and isolation.** Start with `pool: 'vmThreads'` for the jsdom projects, which is
   Vitest's own advice. If you use it, set a memory limit for the VM pool and say why.
   * If a test depends on per-file global state that vmThreads breaks, fix the test's setup.
     Do not drop isolation for the whole project.
   * `isolate: false` is allowed only with a written reason and a test showing no state
     leaks.
2. **Import and transform cost.**
   * Check barrel imports (icon sets, the shadcn `ui/` index, `@bajaovrlay/shared` index)
     and Vite `optimizeDeps` / `server.deps` settings for the test run.
   * Measure, don't guess.
3. **The slowest component tests.** These are typing-heavy.
   * Where a test types a long value only to fill a form, and typing is not what it tests,
     use `userEvent.paste` or `fireEvent.change` (or `userEvent.setup({ delay: null })`).
     Say in the arrange comment that the typing itself is covered elsewhere, and where.
   * Keep real typing where the keystrokes are the behaviour (keyboard shortcuts, the
     rundown keys).
4. **Real time.** Any unit or integration test that sleeps on a real clock moves to fake
   timers or an injected clock, the way the server's time-dependent code already takes
   `nowMs`.

### C. Playwright (target: 6 minutes or less on CI)

1. **Waits.** Remove every fixed `waitForTimeout` that waits for something to happen. Replace
   it with `expect.poll` or a web-first assertion on the thing itself.
   * A fixed wait may stay only where the test proves that something does **not** happen
     (the held clock, the stopped macro). Cut it to the shortest time that still proves it,
     and explain the number in a comment.
2. **Simulated time.**
   * Tests that wait for a race to move should run the seeded simulator at a higher `speed`,
     or start it at a later simulated moment, instead of waiting in real time.
   * Use the existing config; add nothing to the server for tests only.
   * Keep each test's long `test.setTimeout` only if it is still needed after this.
3. **Parallelism.** Two options; pick by measurement:
   * **Sharding.** Run `apps/control` across CI jobs with `--shard=i/n`, each with its own
     server (it already gets its own runner). This is simplest; mind the billed-minutes
     rule.
   * **Workers.** Use `workers > 1` in one job, each worker with its own server, database
     and ports via `BAJAOVRLAY_E2E_PORT_OFFSET`. On 2 cores this may not pay. Measure
     before keeping it.
   * The small packages (renderer, graphics) can run in their own job alongside, instead
     of after, `apps/control`.
4. **The browser install.** Cache `~/.cache/ms-playwright` keyed on the resolved
   `@playwright/test` version. Keep `--with-deps` working on a cache hit.

### D. The workflow

* Lint, typecheck and build may move to a job of their own running in parallel, if that
  helps wall time without breaking the billed-minutes rule.
* When the run is under 12 minutes, set `timeout-minutes` back to 15 per job. Update the
  comment and add a decisions line.
* The upload-on-failure step keeps working in every job that runs Playwright, with distinct
  artifact names per shard.

### E. `pnpm verify` (João's local CI)

A root script that runs, in order, the same commands CI runs:

* install check, lint, typecheck, Vitest, build, Playwright;
* one line per step with its duration, then a final summary;
* it stops at the first failure and names the step that failed.

Details:

* `pnpm verify --quick` skips Playwright, for a fast check before pushing.
* Plain Node with `child_process`, in `scripts/verify.js`; no task runner.
* **It must not drift from CI.** A test in `scripts/` reads `.github/workflows/ci.yml` as text
  and checks that every `run:` command there that runs tests or checks appears in the verify
  script's step list, and the reverse. The test's header explains why it exists.
* Document it in the root README and in `docs/testing-style.md` (a short "Before you push"
  section).

### F. Docs

* `docs/decisions.md`: one line per choice (pool, isolation, sharding count, waits policy,
  timeout).
* A short `docs/ci.md`:
  * what each job does;
  * how to read the slowest-tests table;
  * the waits policy (poll, don't sleep; a fixed wait only to prove something doesn't
    happen);
  * how to run one shard locally.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-42.md` (documentation only).
2. The slowest-tests report script with its test, and CI's step summary. Record the baseline.
3. Vitest pool and import changes. Measure.
4. The slow component tests (typing). Measure.
5. Playwright waits and simulator speed. Measure.
6. Workflow: jobs, sharding, browser cache, `ci-passed`, timeouts.
7. `pnpm verify` and its drift test.
8. Docs and decisions.

Each measuring commit puts its before/after numbers in its commit message.

## Done when

* CI is green, with wall time at or below 12 minutes on the PR's last run (report the
  per-job times), and billed minutes per run at or below the baseline.
* Test counts are unchanged or higher; there are no retries and no skips.
* Every changed wait passed 5 runs in a row.
* `pnpm verify` and `pnpm verify --quick` work on João's machine, and the drift test fails if
  a CI step is added without the script (show this in the PR by describing the check).

The PR description has the before/after table, the commands João can run, "Decisions taken",
and anything left out and why. Report and stop; João merges after gate 2.

## Addendum (João, 2026-10-23): CI waits for gate 2

From the latest comment on the Plane work item.

From now on, PRs open as **drafts**. CI runs only when a PR is marked ready for review,
which happens after gate 2 passes, so review rounds no longer re-run the full suite on every
push.

1. **`ci.yml`:**
   * add `ready_for_review` to the `pull_request` types (keep `opened`, `synchronize` and
     `reopened`);
   * each job gets `if: github.event_name == 'push' || github.event.pull_request.draft == false`;
   * `ci-passed`, if added, follows the same rule;
   * the comment above the triggers explains why.
2. **`CLAUDE.md`, under "Git and process":**
   * Open the PR as a draft (`gh pr create --draft`).
   * Before every push to it, run `pnpm verify` locally, or `pnpm verify --quick` plus the
     e2e tests of the packages touched. Report the result in the round's report.
   * The PR is marked ready (`gh pr ready`, or the button) only when João says gate 2
     passed. That triggers CI, and it is merged only on green CI.
3. **`docs/ci.md`:** state the same flow.
4. **`docs/decisions.md`:** one line for this.

This PR is the first to use the flow. Convert it to a draft now (`gh pr ready --undo`) if it
is already open.

### João's answer in the session: measuring a draft

A draft gets no CI run, so the after numbers of this PR are 2-core local timings
(`taskset`), step by step and per job as CI splits them, as the estimate. ci.yml also gets
`workflow_dispatch` (its jobs allowed to run on it), with one decisions line, so later drafts
can be measured on demand; `gh workflow run` cannot use it on this branch until main has the
trigger. The real CI duration comes from the run when João marks the PR ready after gate 2.
The "done when" 12-minute target is judged on that run; if it misses, that is one more round.
