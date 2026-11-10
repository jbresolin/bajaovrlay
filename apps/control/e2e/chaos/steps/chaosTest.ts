// Test support (chaos suite): the `test` every scenario uses, Playwright's own with one
// fixture more, `startChaosServer`. A server started through it belongs to the scenario:
// when the scenario ends, passed, failed or timed out, every server it started is killed
// and what each wrote (stderr, then its log on stdout) is attached to the scenario's
// report. A scenario never stops its server itself (gate 2 of PR #61): a failure halfway
// can then never leave one running on the chaos ports.
import { test as base } from '@playwright/test';

import {
  type ChaosServer,
  type ExtraServerSettings,
  startChaosServerProcess,
} from '../faults/serverProcess';

export { expect } from '@playwright/test';

/** Starts a server for this scenario: its data folder's name, its port, extra settings. */
export type StartChaosServer = (
  scenarioFolderName: string,
  port: number,
  extraSettings?: ExtraServerSettings,
) => Promise<ChaosServer>;

/** Playwright's `test`, with `startChaosServer` killing what it started when the test ends. */
export const test = base.extend<{ startChaosServer: StartChaosServer }>({
  // Playwright reads which fixtures a fixture needs from its first argument, which must be
  // an object pattern; this one needs none, hence the empty one.
  // eslint-disable-next-line no-empty-pattern
  startChaosServer: async ({}, use, testInfo) => {
    const serversOfThisScenario: ChaosServer[] = [];
    await use(async (scenarioFolderName, port, extraSettings) => {
      const server = await startChaosServerProcess(scenarioFolderName, port, extraSettings);
      serversOfThisScenario.push(server);
      return server;
    });
    for (const server of serversOfThisScenario) {
      await server.kill();
      const whatItWrote = server.readWhatItWrote();
      await testInfo.attach(`server on ${String(server.port)}: stderr`, {
        body: whatItWrote.stderr,
        contentType: 'text/plain',
      });
      await testInfo.attach(`server on ${String(server.port)}: log (stdout)`, {
        body: whatItWrote.stdout,
        contentType: 'text/plain',
      });
    }
  },
});
