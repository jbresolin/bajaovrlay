# CI

`.github/workflows/ci.yml`. Four jobs run side by side, each on its own 2-core runner, so a
run lasts as long as its slowest job (about 5 minutes since BAJAOVRLAY-42; 26 before).

## When it runs

A pull request opens as a **draft**, and CI does not run on a draft: gate 2 (João's review
rounds) goes by without billed CI minutes. Before every push the agent runs `pnpm verify`
(or `pnpm verify --quick` plus the browser tests of the packages touched) and reports it.
When João says gate 2 passed, the PR is marked ready (`gh pr ready`, or the button); that
starts CI, and every push after it runs CI again. Every push to `main` runs it too.
"Run workflow" on the Actions page runs it by hand on any branch, a draft's included, once
`main` has the `workflow_dispatch` trigger.

## The jobs

| Job                                                                | What it does                                                                                                                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and component tests (Vitest)                                  | `pnpm test`: every package's Vitest suite.                                                                                                                                          |
| Lint, typecheck, build, browser tests of the renderer and graphics | `pnpm lint`, `pnpm typecheck`, `pnpm build`, then `pnpm test:e2e:renderer-and-graphics`: the browser tests of every package but the control page, one package at a time.            |
| Browser tests of the control page (shard 1 of 2, 2 of 2)           | `pnpm build`, then `pnpm test:e2e:control --shard=N/2`: half of the control page's browser tests each, on a runner of its own with its own server, database and ports.              |
| CI passed                                                          | Green only when the three above all passed. **João merges only on a green "CI passed".** Branch protection is not available on this repository's plan, so nothing else enforces it. |

Each job has `timeout-minutes: 15`. A job that fails with browser tests uploads its
screenshots, traces and report as an artifact named after it
(`playwright-results-control-shard-1`, …).

## The slowest-tests table

Every job ends by writing the 15 slowest test files and tests of its own run on the run's
summary page (the run's page on GitHub, below the jobs), with the count of tests passed,
failed and skipped (`scripts/reportSlowestTests.js`). Vitest and Playwright write the JSON
reports it reads on CI only. Read it when a run got slower: a file that climbs the table, or
a new name in it, is where the time went. A Playwright test's time includes its
`beforeEach` (the server reset). On your machine, the same table for any reports:
`node scripts/reportSlowestTests.js vitest-report.json apps/control/test-results/playwright-results.json`
(with `CI=1` set on the run that writes them).

## Waits in browser tests

- **Poll, don't sleep.** A test waits for the thing itself: a web-first assertion
  (`await expect(locator).toHaveText(…)`) or `expect.poll` on the server's state.
- **A fixed wait only proves that something does not happen**: the held clock that must not
  move, the macro clear that must not come. Make it the shortest time that still proves it,
  and write next to it why that number.
- **A race that must move runs fast**: the simulator at speed 60 (its maximum), and a seed
  whose event comes early (seed 1405's first yellow is 16 simulated minutes in; seed 227's
  first penalty, 3). No server setting exists for tests only.

## Running one shard on your machine

```sh
pnpm build
pnpm --filter @bajaovrlay/control test:e2e --shard=1/2
```

`pnpm test:e2e:control --shard=2/2` does the same from the root. Another checkout running
browser tests at the same time sets `BAJAOVRLAY_E2E_PORT_OFFSET` (apps/control/e2e/README.md).

On WSL a connection to a closed port on 127.0.0.1 may hang for about two minutes instead of
being refused. Playwright checks each server's port before starting it, so a local browser
run can sit for a while before its first test. CI does not do this; the time is the
machine's, not the tests'.
