# CI

`.github/workflows/ci.yml`. Its jobs run side by side, each on its own 2-core runner, so a
run lasts as long as its slowest job: 7:26 on BAJAOVRLAY-58's own run (#45), where it was
12 to 15 minutes before, when lint, typecheck, build and the renderer and graphics
browser tests shared one job.

## When it runs

A pull request opens as a **draft**, and CI does not run on a draft: gate 2 (João's review
rounds) goes by without billed CI minutes. Before every push the agent runs `pnpm verify`
(or `pnpm verify --quick` plus the browser tests of the packages touched) and reports it.
When João says gate 2 passed, the PR is marked ready (`gh pr ready`, or the button); that
starts CI, and every push after it runs CI again. Every push to `main` runs it too.
"Run workflow" on the Actions page runs it by hand on any branch, a draft's included, once
`main` has the `workflow_dispatch` trigger.

On a draft every job, "CI passed" included, shows as **skipped** (grey). Skipped is not
green: it means nothing was checked. A pull request is ready to merge only when "CI passed"
is green on its latest push, after it was marked ready.

## `pnpm verify` runs with CI's settings

Every step of `pnpm verify` runs with `CI=1` (`scripts/verifySteps.js`): Vitest and
Playwright refuse a forgotten `.only`, and Playwright starts its own servers instead of
reusing one left running, failing if a port is taken. Since a draft gets no CI, this is the
strict check each review round relies on. One test still tells a developer machine from
GitHub's runner: `dataSourcesPageStaysResponsive.e2e.ts` slows the page's CPU 4 times
everywhere but on the runner, so it reads `GITHUB_ACTIONS` (set only there) rather than
`CI`, and keeps that slowdown under `pnpm verify`.

## The jobs

| Job                                                       | What it does                                                                                                                                                                                         | Typical time  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Unit and component tests (Vitest)                         | `pnpm test`: every package's Vitest suite.                                                                                                                                                           | 7:15          |
| Lint, typecheck, build                                    | `pnpm lint`, `pnpm typecheck`, `pnpm build`. No browser.                                                                                                                                             | 3:28          |
| Browser tests of the renderer and graphics (shard 1 of 2) | `pnpm build`, then `pnpm test:e2e:renderer-bracket-tower`: the renderer's, the bracket's and the positions tower's browser tests, one package at a time.                                             | 6:17          |
| Browser tests of the renderer and graphics (shard 2 of 2) | `pnpm build`, then `pnpm test:e2e:other-graphics-and-server`: every other package's browser tests but the control page's (the built server's offline test included), one package at a time.          | 6:00          |
| Browser tests of the control page (shard 1 of 2, 2 of 2)  | `pnpm build`, then `pnpm test:e2e:control --shard=N/2`: half of the control page's browser tests each, on a runner of its own with its own server, database and ports.                               | 5:37 and 7:13 |
| CI passed                                                 | Green only when every job above passed, each shard included. **João merges only on a green "CI passed".** Branch protection is not available on this repository's plan, so nothing else enforces it. | 0:06          |

Times are whole jobs, setup included, from #45's run on 2026-11-06 (run 42309763948). The
browser-test step itself took 5:04 in shard 1 and 4:43 in shard 2 of the renderer and
graphics; setup, the build and the browser install took about a minute and a quarter.

Each job has `timeout-minutes: 15`. A job that fails with browser tests uploads its
screenshots, traces and report as an artifact named after it
(`playwright-results-control-shard-1`, `playwright-results-renderer-and-graphics-shard-2`, …).

**When a job passes 10 minutes, split it again before it reaches 15.** Every new test makes
some job longer, and raising a limit only moves the day it is hit. A job that passes 15 is
cancelled with its tests half run: #43's run was cancelled that way at 15:00.

### How the renderer and graphics are split

By package, in two root scripts (`package.json`), not with Playwright's `--shard`. `--shard`
keeps a package's dependent projects together (the renderer's three real-server projects,
the tower's frame budget after its other tests), so on #44's times it put about 8:20 of
tests in one shard and 2:20 in the other. By package, the three slowest packages (bracket
2:14, renderer 1:50, positions tower 1:02) make shard 1 and every other package shard 2:
about 5:10 and 4:40 estimated, 5:04 and 4:43 measured on #45. A new graphic joins shard 2 without any change to `ci.yml`. When one
shard grows much longer than the other, move a package across: shard 1 names its packages
with `--filter`, shard 2 excludes the same names with `--filter '!…'`.

The tower's frame-budget test still runs alone, after the tower's other tests: it is a
Playwright project that depends on them in the tower's own config, and the whole tower
runs in shard 1.

Each shard runs `pnpm build` itself (0:27 and 0:29 on #45) instead of downloading the
build from "Lint, typecheck, build": a download could start only once that job had finished
its lint and typecheck, 3:07 in on #45.

`pnpm verify` runs the two scripts one after the other; `pnpm test:e2e:renderer-and-graphics`
runs both too.

### Installing the browser

Every browser job installs Chromium with a limit of 5 minutes. It takes about half a
minute, but a slow download once took 12:51, and on #43 one hit the 5 minutes. A failed or
timed-out install is tried **once more**, in a second step with its own 5 minutes; if that
fails too, the job fails there, by name. This retries a download, never a test: a test that
fails is never run again (`retries: 0` in every Playwright config).

## Publishing the Docker image

`.github/workflows/publish-image.yml`, a workflow of its own: on every push to `main` it
builds the `Dockerfile` and pushes it to `ghcr.io/jbresolin/bajaovrlay` as `:latest` and
`:<short sha>`. It never runs on a pull request, is not one of the jobs "CI passed" waits
for, and its failure shows only as a red "Publish image" run on the Actions page and on the
commit. TrueNAS pulls `:latest` from there (`deploy/truenas/README.md`).

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

The fix, in WSL's mirrored networking mode: fewer retries of an unanswered connection
([microsoft/WSL#40343](https://github.com/microsoft/WSL/issues/40343)). A closed port on
127.0.0.1 then fails in about 7 seconds instead of about 127. Inside WSL:

```sh
echo 'net.ipv4.tcp_syn_retries = 2' | sudo tee /etc/sysctl.d/99-faster-connect-failure.conf
sudo sysctl --system
```

The setting lasts across restarts. It applies to every connection from WSL, so an address
that really is slow to answer gets about 7 seconds instead of two minutes before it fails.
