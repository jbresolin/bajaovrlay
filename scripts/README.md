# scripts

Small plain-Node scripts run from the root `package.json`, with no dependency of their own.

- `serveFlexExample.js` (`pnpm serve:flex-example`): serves the fictional timing system of
  the flex source example (`packages/shared/src/flexMapping/examples/`) on
  `http://localhost:4790/cronometragem/classificacao`, the address the example config
  already reads. Import the example config on "Fontes de dados", save and turn it on; stop
  the script to see the source turn "Atrasada", start it again to see it recover.
  Each answer is stamped with the moment it is made and its session clock runs down from
  when the script started (`liveExampleResponse.js`, tested by `liveExampleResponse.test.ts`),
  so the session card shows a believable race clock rather than the file's fixed instant.
- `serveBajaAppExample.js` (`pnpm serve:baja-example`, BAJAOVRLAY-54): serves a stand-in
  of the Baja app's results API for event 26BR on `http://localhost:4791`, from the
  fixtures of `packages/shared/src/flexMapping/examples/bajaApp/`: the event during its
  competition, its teams, its overall table, its Super Prime and the API doc's race as its
  Enduro (no counted race exists on the real API yet). On "Fontes de dados", "Adicionar
  fonte do app Baja" with that address and 26BR. The e2e walk serves the same files itself.
- `writeBuildId.js` (the first step of `pnpm build`): writes `build-id.building.json` at
  the root, the build's moment as its id, which both Vite builds embed.
- `publishBuildId.js` (the last step, reached only when every package built): copies it
  to `build-id.json`, which the server reads once at boot and sends in hello, so an open
  page from an older build reloads itself after the restart (`packages/shared/src/build`).
  Both use `buildIdFile.js`, tested by `buildIdFile.test.ts`.
- `e2ePortOffset.ts` (not a script: every Playwright config and e2e helper imports it):
  reads `BAJAOVRLAY_E2E_PORT_OFFSET` once, a whole number or else 0, tested by
  `e2ePortOffset.test.ts`.
- `checkPortOffset.js` (the first thing `pnpm verify` and `pnpm test:chaos` run,
  BAJAOVRLAY-72): refuses, in one line naming the nearest offsets that work, an offset
  that moves a browser test's port onto 5357 (Windows' WSD service) or into a range
  Windows has excluded (read with netsh.exe on WSL, skipped elsewhere), or past 65535,
  the highest port there is. The judging is in
  `portOffsetSafety.js` (tested by `portOffsetSafety.test.ts`); the ports come from
  `browserTestPorts.js`, the one list of them, which `browserTestPorts.test.ts` holds
  to the files that write each port.
- `uniqueDevPorts.test.ts` (a test, no script): reads every `vite.config.ts` and
  `playwright.config.ts` under `apps/` and `packages/` and fails when two packages write
  the same port, which made `pnpm dev` fail as a whole after PRs #27 and #28.
- `noRealLookingSecrets.test.ts` (a test, no script, BAJAOVRLAY-60): reads every tracked
  file and fails on a value that looks like a real credential (hex of 16+, base64 of 20+,
  the value of a token or password name, a password in a URL, a quoted value next to the
  word senha, password or pass in prose) unless it reads as fake
  ("test", "fake", "example", "placeholder", a `<…>`) or is on
  `secretLookingValuesAllowed.json` (file, first 6 characters, reason). GitGuardian
  flagged fake test tokens on PRs #34 and #43. The rules are in `realLookingSecrets.ts`.
- `reportSlowestTests.js` (CI's "Report the slowest tests" step): reads the Vitest and
  Playwright JSON reports named on its command line and prints the 15 slowest files and
  tests as markdown, which CI appends to the run's summary page (docs/ci.md). The reading
  and writing are in `slowestTests.js` (tested by `slowestTests.test.ts`); reading the files,
  never throwing on a missing or broken one, in `slowestTestsOfReportFiles.js` (tested by
  `slowestTestsOfReportFiles.test.ts`).
- `verify.js` (`pnpm verify`, `pnpm verify --quick`): runs CI's commands in order on
  this machine, one line per step with its time, and stops at the first failure, naming
  it; `--quick` leaves out the browser tests. The steps are in `verifySteps.js` (tested by
  `verifySteps.test.ts`); `verifyMatchesCi.test.ts` reads `.github/workflows/ci.yml`
  through `ciWorkflowCommands.js` and fails when CI and the steps drift apart.
- `checkJobResults.sh` (CI's "CI passed" job): fails unless every result in
  RESULTS_OF_THE_JOBS is "success" (an empty list fails too), tested by
  `checkJobResults.test.ts`.
- `dockerSmoke.sh` (by hand, never on CI: it needs Docker): builds the image, runs it on a
  new volume, waits until Docker calls it healthy, loads `/`, `/render/` and `/health`,
  checks it runs as uid 1000, takes a race clock over the WebSocket with the control page's
  browser-test helper (`dockerSmokeTakeAnItem.ts`), runs the backup command inside it, then
  stops and starts it and checks the clock is still on air; it removes what it made, pass
  or fail. `BAJAOVRLAY_SMOKE_PORT` moves its port (18080).
- `collectImageFiles.sh` (the Dockerfile's build stage only): copies what the image runs
  into one folder laid out as the repository is.
