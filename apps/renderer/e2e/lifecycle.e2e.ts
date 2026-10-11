/**
 * The renderer driving a graphic through its life (apps/renderer, Playwright)
 *
 * What this module is for:
 *   The renderer page mirrors the server's `instances` slice: when the slice says a graphic
 *   is on a layer, the renderer loads its module, puts its element inside that layer's
 *   container and calls the OGraf lifecycle on it (load, playAction, updateAction,
 *   stopAction, dispose). These tests run the real page in Chromium, the engine inside OBS.
 *
 * What these tests prove:
 *   - Take: the graphic is loaded, then played, in that order, inside its layer.
 *   - Update: the graphic gets `updateAction` with only the fields that changed.
 *   - Clear: the graphic is stopped, then disposed, and its element leaves the page.
 *   - Replace on an out-then-in layer: the old graphic has finished stopping and
 *     disposing before the new one starts loading.
 *   - Every lifecycle call is logged with the instance id, the layer and the graphic.
 *   - Two layers work at the same time; one never waits for the other.
 *   - Reconnect, and a page that opens with a graphic already on air (OBS refreshing the
 *     browser source): everything is rebuilt and played with `skipAnimation: true`.
 *
 * What these tests deliberately do not cover:
 *   - Replace on a cut or a crossfade layer, where the new graphic is loaded before the
 *     old one leaves; replaceWithCut.e2e.ts.
 *   - What the renderer tells the server about each instance; instanceStatus.e2e.ts.
 *   - Graphics that fail to load; brokenGraphic.e2e.ts covers those.
 *   - The real server and a real graphic; raceClockOnAir.e2e.ts covers those. Here the
 *     server is a stand-in inside the page (fakeServerForPage.ts) and the graphic is the
 *     fake one in test-fixtures/fake-graphic, which writes down every call it receives.
 *   - How long the reconnect waits; serverConnection.reconnect.test.ts covers the waits.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  makeFakeGraphicCallsTake,
  readFakeGraphicCallsAsSentences,
  readParamsOfCalls,
} from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createFinalInstance,
  createTeamInstance,
  enduroInstanceId,
  finalInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';
import { collectRendererLogLines } from './rendererLogLines.js';

/** Waits until the fake graphics have written exactly these sentences, in this order. */
async function expectCallSentences(
  page: Page,
  expectedSentences: string[],
  message: string,
): Promise<void> {
  await expect
    .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), { message })
    .toEqual(expectedSentences);
}

const callsOfATake = [
  'Enduro: load called',
  'Enduro: load finished',
  'Enduro: playAction called',
  'Enduro: playAction finished',
];

test.describe('one graphic on one layer', () => {
  test('take: loads the graphic, then plays it, inside its layer', async ({ page }) => {
    // Arrange: a renderer connected to a server with nothing on air, and its log kept.
    const logLines = collectRendererLogLines(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: the operator takes the enduro clock.
    fakeServer.sendInstances([createEnduroInstance('green')]);

    // Assert: load finished before play was called, with the arguments OGraf expects,
    // the element sits inside the clock layer's container, and the log says which
    // instance, layer and graphic each call was for.
    await expectCallSentences(page, callsOfATake, 'a take must load, then play, in order');
    const lifecycleCallLogLines = logLines.filter(
      (line) => line.message === 'graphic lifecycle call',
    );
    expect(
      lifecycleCallLogLines,
      'every lifecycle call must be logged with the instance id, the layer and the graphic',
    ).toMatchObject([
      { action: 'load', instanceId: enduroInstanceId, layerId: 'clock', graphicId: 'fake-graphic' },
      {
        action: 'playAction',
        instanceId: enduroInstanceId,
        layerId: 'clock',
        graphicId: 'fake-graphic',
      },
    ]);
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'load'),
      'load must get the resolved data and the 1920x1080 realtime render settings',
    ).toEqual([
      {
        data: { sessionName: 'Enduro de Resistência', state: 'green', lapsCompletedByLeader: 12 },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      },
    ]);
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'playAction'),
      'a take must play step 0 with its in-animation',
    ).toEqual([{ goto: 0 }]);
    await expect(
      page.locator('[data-layer-id="clock"] > baja-graphic-fake-graphic'),
      'the graphic element must be inside the clock layer container',
    ).toHaveCount(1);
  });

  test('update: sends updateAction with only the fields that changed', async ({ page }) => {
    // Arrange: the enduro clock on air under green flag.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await expectCallSentences(page, callsOfATake, 'the clock must be on air first');

    // Act: the flag goes yellow; the session name and the laps stay as they were.
    fakeServer.sendInstances([createEnduroInstance('yellow')]);

    // Assert: one updateAction, carrying the flag state and nothing else.
    await expectCallSentences(
      page,
      [...callsOfATake, 'Enduro: updateAction called', 'Enduro: updateAction finished'],
      'a data change must reach the same graphic as an update, not a reload',
    );
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'updateAction'),
      'updateAction must carry only the changed field',
    ).toEqual([{ data: { state: 'yellow' } }]);
  });

  test('clear: stops the graphic, then disposes it and removes its element', async ({ page }) => {
    // Arrange: the enduro clock on air.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await expectCallSentences(page, callsOfATake, 'the clock must be on air first');

    // Act: the operator clears the layer.
    fakeServer.sendInstances([]);

    // Assert: stop finished before dispose was called, the stop was animated, and the
    // layer container is empty afterwards.
    await expectCallSentences(
      page,
      [
        ...callsOfATake,
        'Enduro: stopAction called',
        'Enduro: stopAction finished',
        'Enduro: dispose called',
        'Enduro: dispose finished',
      ],
      'a clear must stop, then dispose, in order',
    );
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'stopAction'),
      'a clear must stop with the out-animation (no skipAnimation)',
    ).toEqual([{}]);
    await expect(
      page.locator('[data-layer-id="clock"] > *'),
      'the cleared layer must hold no element',
    ).toHaveCount(0);
  });
});

test.describe('replacing a graphic on its layer', () => {
  test('out-then-in: the old graphic is gone before the new one starts loading', async ({
    page,
  }) => {
    // Arrange: every call takes 100 ms (an animation), and the enduro clock is on air.
    await makeFakeGraphicCallsTake(page, 100);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await expectCallSentences(page, callsOfATake, 'the enduro clock must be on air first');

    // Act: the operator takes the final's clock on the same layer.
    fakeServer.sendInstances([createFinalInstance()]);

    // Assert: stop and dispose of the old clock both finished before the new load began,
    // and only the new clock's element is left in the layer.
    await expectCallSentences(
      page,
      [
        ...callsOfATake,
        'Enduro: stopAction called',
        'Enduro: stopAction finished',
        'Enduro: dispose called',
        'Enduro: dispose finished',
        'Final: load called',
        'Final: load finished',
        'Final: playAction called',
        'Final: playAction finished',
      ],
      'an out-then-in replace must finish the old graphic before loading the new one',
    );
    expect(
      await page
        .locator('[data-layer-id="clock"] > *')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-instance-id')),
        ),
      'only the new graphic may remain in the layer',
    ).toEqual([finalInstanceId]);
  });
});

test.describe('several layers', () => {
  test('two layers load at the same time; neither waits for the other', async ({ page }) => {
    // Arrange: every call takes 150 ms, and nothing is on air.
    await makeFakeGraphicCallsTake(page, 150);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: a macro puts the clock and a lower third on air in one go.
    fakeServer.sendInstances([
      createEnduroInstance('green'),
      createTeamInstance(ufprInstanceId, 42, 'Baja UFPR'),
    ]);

    // Assert: both loads were called before either finished, so they overlapped.
    await expect
      .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
        message: 'both graphics must end up played',
      })
      .toHaveLength(8);
    const sentences = await readFakeGraphicCallsAsSentences(page, instanceNames);
    expect(
      sentences.slice(0, 2),
      'the two layers must start loading together, not one after the other',
    ).toEqual(['Enduro: load called', 'UFPR: load called']);
  });
});

test.describe('rebuilding the stage', () => {
  test('a page opened with a graphic already on air plays it without animation', async ({
    page,
  }) => {
    // Arrange: the server already has the enduro clock on air, as when OBS refreshes
    // its browser source in the middle of the race.
    await startFakeServerForPage(page, { instancesOnAir: [createEnduroInstance('green')] });

    // Act: the page opens.
    await openRendererAndWaitForItsLayers(page);

    // Assert: the clock is loaded and played, but its in-animation is skipped.
    await expectCallSentences(page, callsOfATake, 'the on-air graphic must be rebuilt');
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'playAction'),
      'a rebuilt graphic must appear at once, without replaying its in-animation',
    ).toEqual([{ goto: 0, skipAnimation: true }]);
  });

  test('reconnect: disposes what is drawn and rebuilds it with skipAnimation', async ({ page }) => {
    // Arrange: the enduro clock taken normally, so it played with its animation.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await expectCallSentences(page, callsOfATake, 'the clock must be on air first');

    // Act: the server drops the connection (a restart); the page reconnects by itself
    // and hears a new hello with the same clock on air.
    await fakeServer.dropConnection();

    // Assert: the page connected a second time, threw the old element away without
    // animating it out, and built the clock again with the in-animation skipped.
    await expectCallSentences(
      page,
      [
        ...callsOfATake,
        'Enduro: dispose called',
        'Enduro: dispose finished',
        'Enduro: load called',
        'Enduro: load finished',
        'Enduro: playAction called',
        'Enduro: playAction finished',
      ],
      'a reconnect must dispose everything local and rebuild what is on air',
    );
    expect(fakeServer.countConnections(), 'the page must have reconnected once').toBe(2);
    expect(
      await readParamsOfCalls(page, enduroInstanceId, 'playAction'),
      'the first play is animated; the rebuild after the reconnect skips the animation',
    ).toEqual([{ goto: 0 }, { goto: 0, skipAnimation: true }]);
    await expect(
      page.locator('[data-layer-id="clock"] > baja-graphic-fake-graphic'),
      'exactly one clock element must be left after the rebuild',
    ).toHaveCount(1);
  });
});
