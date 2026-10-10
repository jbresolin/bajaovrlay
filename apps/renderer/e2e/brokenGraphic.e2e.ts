/**
 * A graphic that cannot go on air (apps/renderer, Playwright)
 *
 * What this module is for:
 *   A graphic is code the renderer loads at run time, and it can be broken: its files may
 *   be missing, its `load` may throw, or it may refuse the data it is given. On a live
 *   stream that must cost one layer at most. The renderer logs the failure, leaves that
 *   layer empty and carries on with everything else.
 *
 * What these tests prove, once for each of the three ways a graphic can fail (its module
 * cannot be imported, its load rejects, its load is refused with a 400):
 *   - The failure is logged with the instance id.
 *   - The broken graphic leaves no element behind on its layer.
 *   - A graphic taken on another layer at the same moment is played normally.
 *   - The next take on the layer the broken graphic was meant for is played normally.
 *
 * What these tests deliberately do not cover:
 *   - A graphic whose promise never settles; the renderer only awaits the promises
 *     (concept §6), so such a graphic blocks its own layer until the page is reloaded.
 *   - Healthy graphics; lifecycle.e2e.ts covers the calls and their order.
 */
import { expect, test } from '@playwright/test';

import { readFakeGraphicCallsAsSentences } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createInstance,
  createTeamInstance,
  feiInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';

const brokenGraphicScenarios = [
  // The package is listed by the server but its files are gone: the import answers 404.
  {
    name: 'whose module cannot be imported',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'sponsor-roll', {
      sponsorName: 'Oficina do Zé',
    }),
  },
  // The module loads, but its load() throws (a bug in the graphic).
  {
    name: 'whose load rejects',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'fake-graphic', {
      teamNumber: 42,
      fakeGraphicLoadOutcome: 'rejects',
    }),
  },
  // The module loads, but load() answers 400: the graphic does not accept this data.
  {
    name: 'whose load is refused with a 400',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'fake-graphic', {
      teamNumber: 42,
      fakeGraphicLoadOutcome: 'refuses',
    }),
  },
];

test.describe('a graphic that cannot go on air', () => {
  for (const { name, brokenInstance } of brokenGraphicScenarios) {
    test(`a graphic ${name} leaves its layer empty and the others working`, async ({ page }) => {
      // Arrange: a renderer with nothing on air, and every console line kept.
      const consoleLines: string[] = [];
      page.on('console', (message) => consoleLines.push(message.text()));
      const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
      await openRendererAndWaitForItsLayers(page);

      // Act: the broken graphic and the enduro clock are taken together; once the
      // failure is logged, team 7's lower third is taken on the layer the broken one
      // was meant for.
      fakeServer.sendInstances([brokenInstance, createEnduroInstance('green')]);
      await expect
        .poll(
          () =>
            consoleLines.some(
              (line) =>
                line.includes('"message":"graphic could not go on air; its layer stays empty"') &&
                line.includes(ufprInstanceId),
            ),
          { message: 'the failure must be logged with the instance id' },
        )
        .toBe(true);
      const elementsLeftByTheBrokenGraphic = await page
        .locator('[data-layer-id="lower-third"] > *')
        .count();
      fakeServer.sendInstances([
        createTeamInstance(feiInstanceId, 7, 'FEI Baja'),
        createEnduroInstance('green'),
      ]);

      // Assert: the broken graphic left nothing behind, the clock on the other layer
      // played, and the next take on the same layer played too.
      expect(elementsLeftByTheBrokenGraphic, 'a broken graphic must leave its layer empty').toBe(0);
      await expect
        .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
          message: 'the clock and the next lower third must both be played',
        })
        .toEqual(
          expect.arrayContaining(['Enduro: playAction finished', 'FEI: playAction finished']),
        );
      await expect(
        page.locator('[data-layer-id="lower-third"] > baja-graphic-fake-graphic'),
        'the next take must be the only element on the layer',
      ).toHaveCount(1);
    });
  }
});
