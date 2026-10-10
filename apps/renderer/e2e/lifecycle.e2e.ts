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
 *   - Replace on a cut layer: both the stop and the play skip their animation.
 *   - Two layers work at the same time; one never waits for the other.
 *   - Reconnect, and a page that opens with a graphic already on air (OBS refreshing the
 *     browser source): everything is rebuilt and played with `skipAnimation: true`.
 *   - A graphic that cannot be imported, whose load fails or whose load is refused leaves
 *     its layer empty, is logged, and breaks neither the other layers nor the next take.
 *
 * What these tests deliberately do not cover:
 *   - The real server and a real graphic; raceClockOnAir.e2e.ts covers those. Here the
 *     server is a stand-in inside the page (fakeServerForPage.ts) and the graphic is the
 *     fake one in test-fixtures/fake-graphic, which writes down every call it receives.
 *   - How long the reconnect waits; serverConnection.test.ts covers the waits.
 */
import type { Instance } from '@bajaovrlay/shared';
import { expect, type Page, test } from '@playwright/test';

import {
  makeFakeGraphicCallsTake,
  readFakeGraphicCallsAsSentences,
  readParamsOfCalls,
} from './fakeGraphicCalls.js';
import { startFakeServerForPage } from './fakeServerForPage.js';

const enduroInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';
const finalInstanceId = 'b84f6c1e-0a3d-4c59-8e7b-5d2a9f31c602';
const ufprInstanceId = '2c9e7f40-6b1a-4d83-9f25-e1a0c4b7d915';
const feiInstanceId = '91d0a3b7-5e2c-47f6-a8c4-3b6e0f2d7a48';

/** The names the call sentences use for each instance, e.g. "Enduro: load called". */
const instanceNames = {
  [enduroInstanceId]: 'Enduro',
  [finalInstanceId]: 'Final',
  [ufprInstanceId]: 'UFPR',
  [feiInstanceId]: 'FEI',
};

/** Builds an instance as the server lists it: one graphic taken on one program layer. */
function createInstance(
  instanceId: string,
  layerId: string,
  graphicId: string,
  resolvedData: Record<string, unknown>,
): Instance {
  return {
    id: instanceId,
    layerId,
    graphicId,
    target: 'program',
    resolvedData,
    currentStep: 0,
    status: 'loading',
    takenAt: '2026-10-09T13:00:00.000Z',
  };
}

/** The enduro's clock on the clock layer, drawn by the fake graphic. */
function createEnduroInstance(flagState: string): Instance {
  return createInstance(enduroInstanceId, 'clock', 'fake-graphic', {
    sessionName: 'Enduro de Resistência',
    state: flagState,
    lapsCompletedByLeader: 12,
  });
}

/** The final's clock: a different take on the same clock layer. */
function createFinalInstance(): Instance {
  return createInstance(finalInstanceId, 'clock', 'fake-graphic', {
    sessionName: 'Final',
    state: 'pre',
  });
}

/** A lower third naming one team, on the lower-third layer (which cuts). */
function createTeamInstance(instanceId: string, teamNumber: number, teamName: string): Instance {
  return createInstance(instanceId, 'lower-third', 'fake-graphic', { teamNumber, teamName });
}

/** Opens the renderer and waits until it has heard the hello and built its layers. */
async function openRendererAndWaitForItsLayers(page: Page): Promise<void> {
  await page.goto('/render/');
  await expect(
    page.locator('[data-layer-id="clock"]'),
    'the renderer must build the layer containers from the hello',
  ).toBeAttached();
}

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
    // Arrange: a renderer connected to a server with nothing on air.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: the operator takes the enduro clock.
    fakeServer.sendInstances([createEnduroInstance('green')]);

    // Assert: load finished before play was called, with the arguments OGraf expects,
    // and the element sits inside the clock layer's container.
    await expectCallSentences(page, callsOfATake, 'a take must load, then play, in order');
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

  test('cut: the old graphic stops and the new one plays without animation', async ({ page }) => {
    // Arrange: team 42's lower third on air on the lower-third layer, which cuts.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createTeamInstance(ufprInstanceId, 42, 'Baja UFPR')]);
    await expectCallSentences(
      page,
      [
        'UFPR: load called',
        'UFPR: load finished',
        'UFPR: playAction called',
        'UFPR: playAction finished',
      ],
      "team 42's lower third must be on air first",
    );

    // Act: the operator takes team 7's lower third on the same layer.
    fakeServer.sendInstances([createTeamInstance(feiInstanceId, 7, 'FEI Baja')]);

    // Assert: same order as any replace, but both animations are skipped.
    await expectCallSentences(
      page,
      [
        'UFPR: load called',
        'UFPR: load finished',
        'UFPR: playAction called',
        'UFPR: playAction finished',
        'UFPR: stopAction called',
        'UFPR: stopAction finished',
        'UFPR: dispose called',
        'UFPR: dispose finished',
        'FEI: load called',
        'FEI: load finished',
        'FEI: playAction called',
        'FEI: playAction finished',
      ],
      'a cut replace must still finish the old graphic before loading the new one',
    );
    expect(
      await readParamsOfCalls(page, ufprInstanceId, 'stopAction'),
      'on a cut layer the old graphic must stop without its out-animation',
    ).toEqual([{ skipAnimation: true }]);
    expect(
      await readParamsOfCalls(page, feiInstanceId, 'playAction'),
      'on a cut layer the new graphic must play without its in-animation',
    ).toEqual([{ goto: 0, skipAnimation: true }]);
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
