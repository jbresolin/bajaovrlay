/**
 * The renderer telling the server what is really on screen (apps/renderer, Playwright)
 *
 * What this module is for:
 *   After a take the server lists the new instance as `loading`, because it cannot see
 *   the screen. The renderer page can. It connects to the server as a renderer
 *   (`/ws?role=renderer`) and sends an `instanceStatus` message for each instance it tries
 *   to put on air: `on-air` once the graphic has been played, or `failed` with a few words
 *   about why. The control page turns that into the "No ar" badge, or a red one.
 *
 * What these tests prove, with the real page in Chromium:
 *   - The page dials `/ws?role=renderer`, the address by which the server knows a
 *     renderer from an operator.
 *   - After a take, once the graphic was played, the server hears exactly one message:
 *     that instance, `on-air`, with no detail.
 *   - For each way a graphic can fail to go on air (module missing, load rejects, load
 *     refused with a 400, graphic not in the graphics slice, layer not in the layers
 *     slice) the server hears `failed` with a detail that says which of those it was.
 *   - A page that opens with a graphic already on air (OBS refreshing its browser
 *     source) reports it `on-air` too, and so does a page that reconnects.
 *
 * What these tests deliberately do not cover:
 *   - That the report is made only after playAction has resolved, never before; that
 *     needs the page and the server on one clock, so src/instancePlayer.status.test.ts
 *     proves it with a playAction the test holds back.
 *   - What the server does with the message (the `reportInstanceStatus` command and who
 *     may send it); the server's own tests. Here the server is the stand-in of
 *     fakeServerForPage.ts, which only writes down what it hears.
 *   - A report made while the connection is down; src/serverConnection.instanceStatus.test.ts.
 */
import { expect, type Page, test } from '@playwright/test';

import { readFakeGraphicCallsAsSentences } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createEnduroInstance,
  createInstance,
  enduroInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';

const enduroClockIsOnAir = {
  type: 'instanceStatus',
  instanceId: enduroInstanceId,
  status: 'on-air',
};

/** Waits until the fake graphic has finished playing the enduro clock this many times. */
async function waitUntilTheEnduroClockWasPlayed(page: Page, numberOfTimes: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const sentences = await readFakeGraphicCallsAsSentences(page, instanceNames);
        return sentences.filter((sentence) => sentence === 'Enduro: playAction finished').length;
      },
      { message: `the enduro clock must have been played ${numberOfTimes} time(s)` },
    )
    .toBe(numberOfTimes);
}

test.describe('a graphic that goes on air', () => {
  test('the page connects as a renderer and reports the instance on-air after the take', async ({
    page,
  }) => {
    // Arrange: a renderer connected to a server with nothing on air.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: the operator takes the enduro clock, and the graphic plays it.
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await waitUntilTheEnduroClockWasPlayed(page, 1);

    // Assert: the page dialled the renderer's address, and the server heard exactly one
    // message: the clock is on air.
    expect(
      fakeServer.readConnectionAddresses(),
      'the page must connect to /ws?role=renderer, so the server knows it is a renderer',
    ).toEqual([expect.stringMatching(/\/ws\?role=renderer$/)]);
    await expect
      .poll(() => fakeServer.readMessagesFromThePage(), {
        message: 'the server must hear one instanceStatus message saying the clock is on-air',
      })
      .toEqual([enduroClockIsOnAir]);
  });

  test('a page opened with a graphic already on air reports it on-air', async ({ page }) => {
    // Arrange: the server already has the enduro clock on air, as when OBS refreshes its
    // browser source in the middle of the race.
    const fakeServer = await startFakeServerForPage(page, {
      instancesOnAir: [createEnduroInstance('green')],
    });

    // Act: the page opens and rebuilds the clock.
    await openRendererAndWaitForItsLayers(page);
    await waitUntilTheEnduroClockWasPlayed(page, 1);

    // Assert: the rebuilt clock is reported like a fresh take.
    await expect
      .poll(() => fakeServer.readMessagesFromThePage(), {
        message: 'a rebuilt graphic must be reported on-air as well',
      })
      .toEqual([enduroClockIsOnAir]);
  });

  test('a page that reconnects reports again what it rebuilt', async ({ page }) => {
    // Arrange: the enduro clock taken and reported once.
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);
    await waitUntilTheEnduroClockWasPlayed(page, 1);

    // Act: the server drops the connection; the page reconnects, hears a hello with the
    // same clock and rebuilds it.
    await fakeServer.dropConnection();
    await waitUntilTheEnduroClockWasPlayed(page, 2);

    // Assert: the server heard the clock on-air twice, once per connection, so a server
    // that restarted learns again what is on screen.
    await expect
      .poll(() => fakeServer.readMessagesFromThePage(), {
        message: 'after the reconnect the rebuilt clock must be reported on-air again',
      })
      .toEqual([enduroClockIsOnAir, enduroClockIsOnAir]);
    expect(fakeServer.countConnections(), 'the page must have reconnected once').toBe(2);
  });
});

const graphicsThatFailScenarios = [
  // The package is listed by the server but its files are gone: the import answers 404.
  {
    name: 'reports failed when the module of the graphic cannot be imported',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'sponsor-roll', {
      sponsorName: 'Oficina do Zé',
    }),
    expectedDetail:
      'its module could not be loaded: TypeError: Failed to fetch dynamically imported module',
  },
  // The module loads, but its load() throws (a bug in the graphic).
  {
    name: 'reports failed with the error of the graphic when its load rejects',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'fake-graphic', {
      teamNumber: 42,
      fakeGraphicLoadOutcome: 'rejects',
    }),
    expectedDetail:
      'its load failed or was refused: Error: O gráfico de teste foi instruído a falhar no load.',
  },
  // The module loads, but load() answers 400: the graphic does not accept this data.
  {
    name: 'reports failed with the status and the words of the graphic when its load is refused',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'fake-graphic', {
      teamNumber: 42,
      fakeGraphicLoadOutcome: 'refuses',
    }),
    expectedDetail:
      'its load failed or was refused: it answered 400: O gráfico de teste recusou os dados.',
  },
  // The server kept an instance on air after its package was removed.
  {
    name: 'reports failed when the graphic is not in the graphics slice',
    brokenInstance: createInstance(ufprInstanceId, 'lower-third', 'starting-grid', {
      sessionName: 'Final',
    }),
    expectedDetail: 'its graphic is not in the graphics slice',
  },
  // The stand-in server has no `ticker` layer.
  {
    name: 'reports failed when the layer is not in the layers slice',
    brokenInstance: createInstance(ufprInstanceId, 'ticker', 'fake-graphic', {
      headline: 'Baja UFPR lidera o enduro',
    }),
    expectedDetail: 'its layer is not in the layers slice',
  },
];

test.describe('a graphic that cannot go on air', () => {
  for (const { name, brokenInstance, expectedDetail } of graphicsThatFailScenarios) {
    test(name, async ({ page }) => {
      // Arrange: a renderer connected to a server with nothing on air.
      const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
      await openRendererAndWaitForItsLayers(page);

      // Act: the broken graphic of this row is taken.
      fakeServer.sendInstances([brokenInstance]);

      // Assert: the server hears exactly one message: that instance failed, and why.
      await expect
        .poll(() => fakeServer.readMessagesFromThePage(), {
          message: 'the server must hear one instanceStatus message saying the instance failed',
        })
        .toHaveLength(1);
      expect(
        fakeServer.readMessagesFromThePage(),
        'the message must name the instance, say failed, and carry a detail that says why',
      ).toEqual([
        {
          type: 'instanceStatus',
          instanceId: ufprInstanceId,
          status: 'failed',
          detail: expect.stringContaining(expectedDetail),
        },
      ]);
    });
  }
});
