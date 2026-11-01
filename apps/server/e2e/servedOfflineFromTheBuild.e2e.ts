/**
 * The built system with no internet (apps/server, browser tests)
 *
 * What this module is for:
 *   At the event the stream PC has no internet at all: the Docker image must carry every
 *   page, script, font and graphic, and nothing may be fetched from anywhere else. A font
 *   from a CDN would not fail loudly; OBS would quietly draw the clock in another face.
 *   These tests serve the built output with the built server (`node dist/main.js`, what
 *   the image runs) and refuse, inside the browser, every request to any other address.
 *
 * What these tests prove (Chromium, the built server, a new database):
 *   - The control page loads, connects, and asks nothing of any other address; no request
 *     fails and none is answered with an error.
 *   - /render/ loads, and the race clock taken over the WebSocket is drawn in Bebas Neue,
 *     with the same two guarantees for the page, the graphic and the theme it loads.
 *
 * What these tests deliberately do not cover:
 *   - The Docker image itself (its files, its user, its volume): scripts/dockerSmoke.sh
 *     builds and runs it on João's machine; CI has no Docker step.
 *   - Every graphic: the race clock stands for them; each graphic's own browser tests load
 *     it from its built dist, through the same /graphics/ and /theme/ addresses.
 *   - A real machine with the network cable out: João's dry run after the merge.
 */
import { type BrowserContext, expect, test } from '@playwright/test';

import { sendCommandOrFail } from '../../control/e2e/eventInboxOnTheRealServer.js';
import { builtServerAddress, builtServerPort } from './builtServer.js';

/** What went wrong with the network while a page loaded, as sentences a reader can act on. */
type NetworkTrouble = {
  requestsToOtherAddresses: string[];
  failedRequests: string[];
  errorAnswers: string[];
};

/**
 * Refuses every request of the browser context that is not for the built server, as a
 * machine with no internet would, and notes it; also notes every request that failed and
 * every answer of 400 or above, from the page and from any frame inside it.
 */
async function blockEveryOtherAddressAndWatchTheNetwork(
  browserContext: BrowserContext,
): Promise<NetworkTrouble> {
  const trouble: NetworkTrouble = {
    requestsToOtherAddresses: [],
    failedRequests: [],
    errorAnswers: [],
  };
  await browserContext.route('**/*', async (route) => {
    const address = route.request().url();
    const isForTheBuiltServer = address.startsWith(`${builtServerAddress}/`);
    if (isForTheBuiltServer) {
      await route.continue();
      return;
    }
    trouble.requestsToOtherAddresses.push(address);
    await route.abort('internetdisconnected');
  });
  browserContext.on('requestfailed', (request) => {
    // A blocked request fails too; it is already noted above, by its address.
    const isForTheBuiltServer = request.url().startsWith(`${builtServerAddress}/`);
    if (isForTheBuiltServer) {
      trouble.failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? '?'}`);
    }
  });
  browserContext.on('response', (response) => {
    if (response.status() >= 400) {
      trouble.errorAnswers.push(`${String(response.status())} ${response.url()}`);
    }
  });
  return trouble;
}

/** The enduro's race clock under green flag, held at 1:05:00, as an item's typed-in fields. */
const heldEnduroClockFields = {
  sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
  state: { kind: 'literal', value: 'green' },
  clockMode: { kind: 'literal', value: 'elapsed' },
  referenceTimeMs: { kind: 'literal', value: 3_900_000 },
  referenceWallClockMs: { kind: 'literal', value: Date.parse('2026-05-16T14:30:00.000Z') },
  running: { kind: 'literal', value: false },
  lapsCompletedByLeader: { kind: 'literal', value: 12 },
};

/** Makes the held enduro clock an item of "Sessão principal" and takes it, over the WebSocket. */
async function takeTheHeldEnduroClock(): Promise<void> {
  const created = await sendCommandOrFail(builtServerPort, {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    layerId: 'clock',
    graphicId: 'race-clock',
    fields: heldEnduroClockFields,
    label: 'Relógio do enduro — sem internet',
  });
  await sendCommandOrFail(builtServerPort, { type: 'takeItem', itemId: created.createdItemId });
}

test.describe('the built system with every other address blocked', () => {
  test('loads the control page with nothing fetched from elsewhere and no failed request', async ({
    page,
    context,
  }) => {
    // Arrange: the browser can reach the built server and nothing else.
    const trouble = await blockEveryOtherAddressAndWatchTheNetwork(context);

    // Act: open the control page and wait until it is connected and the network is quiet.
    await page.goto('/');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the control page must connect to the server with no internet',
    ).toHaveText('Conectado');
    await page.waitForLoadState('networkidle');

    // Assert: nothing was asked of another address, nothing failed, nothing answered an error.
    expect(
      trouble.requestsToOtherAddresses,
      'the control page must fetch nothing from elsewhere',
    ).toEqual([]);
    expect(trouble.failedRequests, 'no request to the server may fail').toEqual([]);
    expect(trouble.errorAnswers, 'no request may be answered with an error').toEqual([]);
  });

  test('draws the race clock on /render/ in its own font with nothing fetched from elsewhere', async ({
    page,
    context,
  }) => {
    // Arrange: the browser can reach the built server and nothing else, and /render/ is
    // open as OBS opens it.
    const trouble = await blockEveryOtherAddressAndWatchTheNetwork(context);
    await page.goto('/render/');
    await expect(
      page.locator('[data-layer-id="clock"]'),
      'the renderer must build its layers from the server with no internet',
    ).toBeAttached();

    // Act: take the race clock over the WebSocket, as the control page does, and wait for
    // the graphic to be drawn and the network to be quiet.
    await takeTheHeldEnduroClock();
    await expect(
      page
        .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
        .getByTestId('race-clock-panel'),
      'the race clock must be drawn on the stage',
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    const loadedFontFamilies = await page.evaluate(() =>
      Array.from(document.fonts)
        .filter((fontFace) => fontFace.status === 'loaded')
        .map((fontFace) => fontFace.family),
    );

    // Assert: the on-air face came from the image, and nothing else went wrong.
    expect(loadedFontFamilies, 'Bebas Neue must be loaded from the server itself').toContain(
      'Bebas Neue',
    );
    expect(
      trouble.requestsToOtherAddresses,
      'the renderer and the graphic must fetch nothing from elsewhere',
    ).toEqual([]);
    expect(trouble.failedRequests, 'no request to the server may fail').toEqual([]);
    expect(trouble.errorAnswers, 'no request may be answered with an error').toEqual([]);
  });
});
