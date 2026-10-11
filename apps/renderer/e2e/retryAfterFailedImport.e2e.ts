/**
 * Taking a graphic again after its package was rebuilt (apps/renderer, Playwright)
 *
 * What this module is for:
 *   A graphic's code is imported by its address the first time it is taken. If that fails
 *   (the package was not built yet), Chromium remembers the failure for that exact address
 *   for as long as the page lives, and would never ask the server again. So on the next
 *   take of the same graphic the renderer imports the same file under a new address,
 *   `…/<main>?retry=1`, then `?retry=2`, and so on. That is what lets someone build the
 *   package and take the graphic again without refreshing the browser source in OBS.
 *
 * What these tests prove, in Chromium (the engine inside OBS):
 *   - A take of a graphic whose files are missing fails, and after the files appear the
 *     next take of that graphic goes on air, with no page reload in between.
 *   - The second import really reached the server, at `…/sponsor-roll.js?retry=1`.
 *   - The retry is written to the log with the graphic and its retry number.
 *   - The server hears `failed` for the first instance and `on-air` for the second.
 *
 * What these tests deliberately do not cover:
 *   - The retry number counting on (`?retry=2`, …) and two takes sharing one failed
 *     import; src/graphicLoader.test.ts.
 *   - A real package and a real build: the stand-in server (fakeServerForPage.ts) answers
 *     404 for the sponsor roll until the test "builds" it, then serves the fake graphic.
 */
import { expect, test } from '@playwright/test';

import { readFakeGraphicCallsAsSentences } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createInstance,
  feiInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';
import { collectRendererLogLines, waitForLogLineAboutInstance } from './rendererLogLines.js';

/** Builds a take of the sponsor roll on the lower-third layer, under the given instance id. */
function createSponsorRollInstance(instanceId: string) {
  return createInstance(instanceId, 'lower-third', 'sponsor-roll', {
    sponsorName: 'Oficina do Zé',
  });
}

test.describe('a graphic whose import failed', () => {
  test('goes on air on the next take once its package is built, without reloading the page', async ({
    page,
  }) => {
    // Arrange: the sponsor roll was taken while its files were missing, and the renderer
    // has logged that it could not go on air.
    const logLines = collectRendererLogLines(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createSponsorRollInstance(ufprInstanceId)]);
    await waitForLogLineAboutInstance(
      logLines,
      'graphic could not go on air; its layer stays empty',
      ufprInstanceId,
    );

    // Act: someone builds the package, and the operator takes the sponsor roll again
    // (a new take is a new instance).
    fakeServer.buildSponsorRollPackage();
    fakeServer.sendInstances([createSponsorRollInstance(feiInstanceId)]);

    // Assert: the second take was played and is on its layer; the server was asked for
    // the module a second time, under the ?retry=1 address; the retry is in the log; and
    // the server heard failed for the first take and on-air for the second.
    await expect
      .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
        message: 'the take after the build must be loaded and played',
      })
      .toContain('FEI: playAction finished');
    await expect(
      page.locator('[data-layer-id="lower-third"] > baja-graphic-sponsor-roll'),
      'the sponsor roll must be on its layer after the second take',
    ).toHaveCount(1);
    expect(
      fakeServer.readSponsorRollRequests(),
      'the second import must reach the server under a new address ending in ?retry=1',
    ).toEqual([
      '/graphics/sponsor-roll/sponsor-roll.js',
      '/graphics/sponsor-roll/sponsor-roll.js?retry=1',
    ]);
    expect(
      logLines.filter(
        (line) => line.message === 'graphic module import retried after an earlier failure',
      ),
      'the retry must be logged with the graphic, its number and the address',
    ).toMatchObject([
      {
        level: 'info',
        graphicId: 'sponsor-roll',
        retryNumber: 1,
        moduleAddress: '/graphics/sponsor-roll/sponsor-roll.js?retry=1',
      },
    ]);
    await expect
      .poll(() => fakeServer.readMessagesFromThePage(), {
        message: 'the server must hear failed for the first take and on-air for the second',
      })
      .toMatchObject([
        { type: 'instanceStatus', instanceId: ufprInstanceId, status: 'failed' },
        { type: 'instanceStatus', instanceId: feiInstanceId, status: 'on-air' },
      ]);
  });
});
