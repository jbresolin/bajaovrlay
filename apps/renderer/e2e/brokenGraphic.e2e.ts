/**
 * A graphic that cannot go on air (apps/renderer, Playwright)
 *
 * What this module is for:
 *   A graphic is code the renderer loads at run time, and it can be broken: its files may
 *   be missing, its `load` may throw, or it may refuse the data it is given. The slices
 *   can also name a graphic or a layer the renderer was never told about. On a live
 *   stream any of these must cost one layer at most. The renderer logs the failure,
 *   leaves that layer empty and carries on with everything else.
 *
 * What these tests prove, once for each of the four ways a graphic can fail to go on air
 * (its module cannot be imported, its load rejects, its load is refused with a 400, its
 * graphic is missing from the graphics slice):
 *   - The failure is logged with the instance id, the layer, the graphic and the reason.
 *   - The broken graphic leaves no element behind on its layer.
 *   - A graphic taken on another layer at the same moment is played normally.
 *   - The next take on the layer the broken graphic was meant for is played normally.
 * And one case of its own:
 *   - An instance on a layer that is not in the layers slice is logged and draws nothing.
 * And the opposite, a graphic that looks broken but is not. OGraf v1 says: "If the
 * returned Promise resolves to `undefined`, it MUST be treated as a `{ statusCode: 200 }`."
 *   - A graphic whose load answers nothing goes on air and is played like any other.
 *   - A graphic whose dispose answers nothing is removed from its layer, and no error is
 *     logged about it.
 *
 * What these tests deliberately do not cover:
 *   - A graphic whose promise never settles; the renderer only awaits the promises
 *     (concept §6), so such a graphic blocks its own layer until the page is reloaded.
 *   - Taking the same broken graphic again: a failed import is remembered until the page
 *     is reloaded (graphicLoader.test.ts).
 *   - Healthy graphics; lifecycle.e2e.ts covers the calls and their order.
 */
import { expect, test } from '@playwright/test';

import { readFakeGraphicCallsAsSentences } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createInstance,
  createTeamInstance,
  enduroInstanceId,
  feiInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';
import { collectRendererLogLines, waitForLogLineAboutInstance } from './rendererLogLines.js';

const couldNotGoOnAirMessage = 'graphic could not go on air; its layer stays empty';

/** Builds team 42's lower third drawn by the fake graphic, told how its load must go wrong. */
function createLowerThirdWhoseLoad(fakeGraphicLoadOutcome: string) {
  return createInstance(ufprInstanceId, 'lower-third', 'fake-graphic', {
    teamNumber: 42,
    fakeGraphicLoadOutcome,
  });
}

const brokenGraphicScenarios = [
  // The package is listed by the server but its files are gone: the import answers 404.
  {
    nameOfTheEmptyLayerTest:
      'a graphic whose module cannot be imported leaves its layer empty while the clock plays',
    nameOfTheNextTakeTest:
      'the next take plays on the layer of a graphic whose module could not be imported',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'sponsor-roll', {
      sponsorName: 'Oficina do Zé',
    }),
    reasonInTheLog: 'its module could not be loaded',
  },
  // The module loads, but its load() throws (a bug in the graphic).
  {
    nameOfTheEmptyLayerTest:
      'a graphic whose load rejects leaves its layer empty while the clock plays',
    nameOfTheNextTakeTest: 'the next take plays on the layer of a graphic whose load rejected',
    brokenInstance: createLowerThirdWhoseLoad('rejects'),
    reasonInTheLog: 'its load failed or was refused',
  },
  // The module loads, but load() answers 400: the graphic does not accept this data.
  {
    nameOfTheEmptyLayerTest:
      'a graphic whose load is refused with a 400 leaves its layer empty while the clock plays',
    nameOfTheNextTakeTest: 'the next take plays on the layer of a graphic whose load was refused',
    brokenInstance: createLowerThirdWhoseLoad('refuses'),
    reasonInTheLog: 'its load failed or was refused',
  },
  // The instance names a graphic the graphics slice no longer lists: the server keeps an
  // instance on air when its package is removed, so a refresh in OBS meets exactly this.
  {
    nameOfTheEmptyLayerTest:
      'an instance whose graphic is not in the graphics slice leaves its layer empty while the clock plays',
    nameOfTheNextTakeTest:
      'the next take plays on the layer of an instance whose graphic was not in the graphics slice',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'starting-grid', {
      sessionName: 'Final',
    }),
    reasonInTheLog: 'its graphic is not in the graphics slice',
  },
];

test.describe('a graphic that cannot go on air', () => {
  for (const scenario of brokenGraphicScenarios) {
    const { brokenInstance, reasonInTheLog } = scenario;

    test(scenario.nameOfTheEmptyLayerTest, async ({ page }) => {
      // Arrange: a renderer with nothing on air, and its log kept.
      const logLines = collectRendererLogLines(page);
      const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
      await openRendererAndWaitForItsLayers(page);

      // Act: the broken graphic and the enduro clock are taken together.
      fakeServer.sendInstances([brokenInstance, createEnduroInstance('green')]);

      // Assert: the failure is logged with its ids and reason, the clock on the other
      // layer played, and the broken graphic left nothing behind on its own layer.
      const failureLogLine = await waitForLogLineAboutInstance(
        logLines,
        couldNotGoOnAirMessage,
        ufprInstanceId,
      );
      expect(
        failureLogLine,
        'the failure must be logged with the instance id, the layer, the graphic and why',
      ).toMatchObject({
        level: 'error',
        instanceId: ufprInstanceId,
        layerId: 'lower-third',
        graphicId: brokenInstance.graphicId,
        reason: expect.stringContaining(reasonInTheLog),
      });
      await expect
        .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
          message: 'the clock on the other layer must be played',
        })
        .toContain('Enduro: playAction finished');
      await expect(
        page.locator('[data-layer-id="lower-third"] > *'),
        'a broken graphic must leave its layer empty',
      ).toHaveCount(0);
    });

    test(scenario.nameOfTheNextTakeTest, async ({ page }) => {
      // Arrange: the broken graphic was taken together with the clock, and its failure
      // has already been logged.
      const logLines = collectRendererLogLines(page);
      const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
      await openRendererAndWaitForItsLayers(page);
      fakeServer.sendInstances([brokenInstance, createEnduroInstance('green')]);
      await waitForLogLineAboutInstance(logLines, couldNotGoOnAirMessage, ufprInstanceId);

      // Act: team 7's lower third is taken on the layer the broken one was meant for.
      fakeServer.sendInstances([
        createTeamInstance(feiInstanceId, 7, 'FEI Baja'),
        createEnduroInstance('green'),
      ]);

      // Assert: the new lower third played, and it is the only element on its layer.
      await expect
        .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
          message: 'the next take on that layer must be played',
        })
        .toContain('FEI: playAction finished');
      expect(
        await page
          .locator('[data-layer-id="lower-third"] > *')
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-instance-id')),
          ),
        'the next take must be the only element on the layer',
      ).toEqual([feiInstanceId]);
    });
  }

  test('an instance on a layer that is not in the layers slice is logged and draws nothing', async ({
    page,
  }) => {
    // Arrange: a renderer with nothing on air; the stand-in server has no `ticker` layer.
    const logLines = collectRendererLogLines(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    const tickerInstance = createInstance(ufprInstanceId, 'ticker', 'fake-graphic', {
      headline: 'Baja UFPR lidera o enduro',
    });

    // Act: a graphic is taken on the ticker layer, together with the enduro clock.
    fakeServer.sendInstances([tickerInstance, createEnduroInstance('green')]);

    // Assert: the failure is logged with its ids and reason, and the only graphic on the
    // whole stage is the clock: the ticker graphic was never loaded.
    const failureLogLine = await waitForLogLineAboutInstance(
      logLines,
      couldNotGoOnAirMessage,
      ufprInstanceId,
    );
    expect(
      failureLogLine,
      'the failure must name the instance, the unknown layer, the graphic and why',
    ).toMatchObject({
      level: 'error',
      instanceId: ufprInstanceId,
      layerId: 'ticker',
      graphicId: 'fake-graphic',
      reason: 'its layer is not in the layers slice',
    });
    await expect
      .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
        message: 'only the clock must be loaded and played; the ticker graphic never is',
      })
      .toEqual([
        'Enduro: load called',
        'Enduro: load finished',
        'Enduro: playAction called',
        'Enduro: playAction finished',
      ]);
    expect(
      await page
        .locator('#stage baja-graphic-fake-graphic')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-instance-id')),
        ),
      'the clock must be the only graphic element on the stage',
    ).toEqual([enduroInstanceId]);
  });
});

test.describe('a graphic that answers nothing, which OGraf counts as a 200', () => {
  test('a graphic whose load answers nothing goes on air and is played', async ({ page }) => {
    // Arrange: a renderer with nothing on air, and its log kept.
    const logLines = collectRendererLogLines(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: team 42's lower third is taken, drawn by a graphic whose load resolves with
    // no answer object (an `async load()` with no `return`).
    fakeServer.sendInstances([createLowerThirdWhoseLoad('answers-nothing')]);

    // Assert: the graphic was played and is on its layer, its load is logged as an
    // assumed 200, and nothing was logged about a graphic that could not go on air.
    await expect
      .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
        message: 'a graphic whose load answers nothing must be played like any other',
      })
      .toContain('UFPR: playAction finished');
    expect(
      await page
        .locator('[data-layer-id="lower-third"] > *')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-instance-id')),
        ),
      'the graphic must stay on its layer',
    ).toEqual([ufprInstanceId]);
    const loadAnswerLogLine = await waitForLogLineAboutInstance(
      logLines,
      'graphic lifecycle call answered',
      ufprInstanceId,
    );
    expect(
      loadAnswerLogLine,
      'the load must be logged at info level as a 200 the renderer assumed',
    ).toMatchObject({
      level: 'info',
      action: 'load',
      statusCode: 200,
      wasAnsweredWithNothing: true,
    });
    expect(
      logLines.filter((line) => line.message === couldNotGoOnAirMessage),
      'a load that answers nothing must not be reported as a failure',
    ).toEqual([]);
  });

  test('a graphic whose dispose answers nothing is removed from its layer and no error is logged', async ({
    page,
  }) => {
    // Arrange: the enduro clock on air, drawn by a graphic whose dispose will resolve
    // with no answer object (an `async dispose()` with no `return`).
    const logLines = collectRendererLogLines(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    const clockWhoseDisposeAnswersNothing = createInstance(
      enduroInstanceId,
      'clock',
      'fake-graphic',
      { sessionName: 'Enduro de Resistência', fakeGraphicDisposeOutcome: 'answers-nothing' },
    );
    fakeServer.sendInstances([clockWhoseDisposeAnswersNothing]);
    await expect
      .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
        message: 'the clock must be on air first',
      })
      .toContain('Enduro: playAction finished');

    // Act: the operator clears the layer.
    fakeServer.sendInstances([]);

    // Assert: the element is gone, the dispose is logged as an assumed 200, and the
    // renderer logged no error at all.
    await expect(
      page.locator('[data-layer-id="clock"] > *'),
      'the cleared layer must hold no element',
    ).toHaveCount(0);
    // waitForLogLineAboutInstance is not used here on purpose: it returns the first line
    // with this message about the instance, which is the answer to its load, not the
    // answer to its dispose. This finder also looks at the action.
    const findDisposeAnswerLogLine = () =>
      logLines.find(
        (line) =>
          line.message === 'graphic lifecycle call answered' &&
          line.instanceId === enduroInstanceId &&
          line.action === 'dispose',
      );
    await expect
      .poll(() => findDisposeAnswerLogLine() !== undefined, {
        message: 'the answer to the dispose must be logged',
      })
      .toBe(true);
    expect(
      findDisposeAnswerLogLine(),
      'the dispose must be logged at info level as a 200 the renderer assumed',
    ).toMatchObject({
      level: 'info',
      action: 'dispose',
      instanceId: enduroInstanceId,
      layerId: 'clock',
      statusCode: 200,
      wasAnsweredWithNothing: true,
    });
    expect(
      logLines.filter((line) => line.level === 'error'),
      'a dispose that answers nothing must not be logged as an error',
    ).toEqual([]);
  });
});
