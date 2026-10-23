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
- `writeBuildId.js` (the first step of `pnpm build`): writes `build-id.building.json` at
  the root, the build's moment as its id, which both Vite builds embed.
- `publishBuildId.js` (the last step, reached only when every package built): copies it
  to `build-id.json`, which the server reads once at boot and sends in hello, so an open
  page from an older build reloads itself after the restart (`packages/shared/src/build`).
  Both use `buildIdFile.js`, tested by `buildIdFile.test.ts`.
- `e2ePortOffset.ts` (not a script: every Playwright config and e2e helper imports it):
  reads `BAJAOVRLAY_E2E_PORT_OFFSET` once, a whole number or else 0, tested by
  `e2ePortOffset.test.ts`.
- `reportSlowestTests.js` (CI's "Report the slowest tests" step): reads the Vitest and
  Playwright JSON reports named on its command line and prints the 15 slowest files and
  tests as markdown, which CI appends to the run's summary page (docs/ci.md). The reading
  and writing are in `slowestTests.js`, tested by `slowestTests.test.ts`.
- `verify.js` (`pnpm verify`, `pnpm verify --quick`): runs CI's commands in order on
  this machine, one line per step with its time, and stops at the first failure, naming
  it; `--quick` leaves out the browser tests. The steps are in `verifySteps.js` (tested by
  `verifySteps.test.ts`); `verifyMatchesCi.test.ts` reads `.github/workflows/ci.yml`
  through `ciWorkflowCommands.js` and fails when CI and the steps drift apart.
