/**
 * Chaos: the WebSocket drops (apps/control, Playwright)
 *
 * What this module is for:
 *   The console and the output each hold one WebSocket to the server, over a studio
 *   network that sometimes drops. A drop must never make a take happen twice, never take
 *   a graphic off air, never replay one's entrance, and never leave a console showing an
 *   old air once it is back. Each page here talks to the server through a connection proxy
 *   of its own (faults/connectionProxy.ts), so one page's link breaks while the rest of
 *   the show carries on.
 *
 * What these tests prove:
 *   - A take whose answer is lost (the command reached the server, the link dropped before
 *     the answer came back) happens once: one entrance on air, and the console, back,
 *     shows the button's item on the Camadas row and says the server did not answer in
 *     time, so the operator checks Camadas instead of pressing again.
 *   - A take whose command is lost (the link dropped before it reached the server) does
 *     not happen at all, and the console says so the same way.
 *   - The output's own link drops with a lower third on air: it stays on air at every
 *     frame, and the rebuild once the output is back does not play its entrance again.
 *   - A console offline for a minute while another operator takes a lower third shows
 *     "Reconectando…" meanwhile, and the new air once it is back.
 *
 * What these tests deliberately do not cover:
 *   - The console's own back-off and its timeout: serverConnection's Vitest tests.
 *   - A stalled link that stays open: the server's heartbeat drops a client that has not
 *     answered a ping within 15 to 30 s (heartbeat.test.ts); the console offline for a
 *     minute is cut, not stalled.
 */

import { startConnectionProxy } from './faults/connectionProxy';
import { chaosServerPort, firstConsoleProxyPort, outputProxyPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  findConnectionBadge,
  findLayerRowInCamadas,
  fireTheFirstButtonWithKeyOne,
  openTheConsoleAt,
  openTheProgramOutputAt,
  waitUntilTheConsoleIsConnected,
} from './steps/pagesOfTheShow';
import {
  makeLowerThirdButton,
  readInstanceOnProgram,
  sendCommandOrFail,
} from './steps/showOnTheChaosServer';
import {
  countEntrancesOnLayer,
  expectTheInstanceStayedOnAirUntouched,
} from './steps/whatTheAirShowed';

const lowerThirdLabel = 'Tarja — capitã da UFPR';
const personName = 'Ana Souza';
const answerTimedOutMessage =
  'O servidor não respondeu em 5 segundos. Confira nas camadas se o comando foi aplicado.';
// The console says it got no answer 5 s after it sent the command; the wait for that
// sentence starts later (after the reconnect), so it waits the 5 s and a margin.
const waitForTheTimedOutSentenceInMilliseconds = 10_000;
// How long a console stays offline in the "offline for a minute" scenario: the minute the
// brief names, long past the console's longest back-off (5 s).
const aMinuteOfflineInMilliseconds = 60_000;

test.describe('a WebSocket drop in the middle of a take', () => {
  test('applies a take whose answer was lost once, and the console shows it once back', async ({
    context,
    startChaosServer,
  }) => {
    const consoleProxy = await startConnectionProxy(firstConsoleProxyPort, chaosServerPort);
    try {
      // Arrange: a server with a "Tarja" button; the output; the console through a proxy.
      const server = await startChaosServer('takeAnswerLost', chaosServerPort);
      await makeLowerThirdButton(server.port, lowerThirdLabel, personName);
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, consoleProxy.address);

      // Act: the server's answers stop reaching the console; the operator presses 1; once
      // the take is on the server, the link drops, its answer never delivered.
      consoleProxy.holdWhatTheServerSends();
      await fireTheFirstButtonWithKeyOne(consolePage);
      await expect
        .poll(async () => (await readInstanceOnProgram(chaosServerPort, 'lower-third'))?.itemId, {
          message: 'the take must reach the server',
        })
        .toBeDefined();
      consoleProxy.dropWebSockets();
      consoleProxy.release();

      // Assert: the console is back, says the answer did not come, and Camadas names the
      // item on air; on air, one entrance, not two.
      await waitUntilTheConsoleIsConnected(consolePage);
      await expect(
        // The rundown and the quick fire strip both show a failed take; the first suffices.
        consolePage.getByRole('alert').filter({ hasText: answerTimedOutMessage }).first(),
        'the console must say the server did not answer, so the operator checks Camadas',
      ).toBeVisible({ timeout: waitForTheTimedOutSentenceInMilliseconds });
      await expect(
        findLayerRowInCamadas(consolePage, 'Tarja'),
        'Camadas must show the take that happened while the answer was lost',
      ).toContainText(lowerThirdLabel);
      await expect(
        output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
        'the lower third must be on air',
      ).toContainText(personName);
      expect(
        countEntrancesOnLayer(output.logLines, 'lower-third'),
        'the take must have happened once, never twice',
      ).toBe(1);
    } finally {
      await consoleProxy.stop();
    }
  });

  test('does not apply a take whose command was lost, and the console says it got no answer', async ({
    context,
    startChaosServer,
  }) => {
    const consoleProxy = await startConnectionProxy(firstConsoleProxyPort, chaosServerPort);
    try {
      // Arrange: a server with a "Tarja" button; the output; the console through a proxy.
      const server = await startChaosServer('takeCommandLost', chaosServerPort);
      await makeLowerThirdButton(server.port, lowerThirdLabel, personName);
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, consoleProxy.address);

      // Act: what the console sends stops reaching the server; the operator presses 1; once
      // the console has sent the take, the link drops with it still held: it never arrives.
      consoleProxy.holdWhatThePageSends();
      await fireTheFirstButtonWithKeyOne(consolePage);
      await expect
        .poll(() => consoleProxy.countChunksHeldFromThePage(), {
          message: 'the console must have sent the take',
        })
        .toBeGreaterThan(0);
      consoleProxy.dropWebSockets();
      consoleProxy.release();

      // Assert: back, the console says the server did not answer, and nothing is on air.
      await waitUntilTheConsoleIsConnected(consolePage);
      await expect(
        consolePage.getByRole('alert').filter({ hasText: answerTimedOutMessage }).first(),
        'the console must say the server did not answer',
      ).toBeVisible({ timeout: waitForTheTimedOutSentenceInMilliseconds });
      await expect(
        findLayerRowInCamadas(consolePage, 'Tarja'),
        'Camadas must show the lower third layer empty',
      ).toContainText('vazia');
      expect(
        await readInstanceOnProgram(chaosServerPort, 'lower-third'),
        'the lost take must not have happened on the server',
      ).toBeUndefined();
      expect(
        countEntrancesOnLayer(output.logLines, 'lower-third'),
        'nothing may have played on the lower third layer',
      ).toBe(0);
    } finally {
      await consoleProxy.stop();
    }
  });
});

test.describe("the output's WebSocket drops with graphics on air", () => {
  test('keeps the lower third on air at every frame, and does not replay its entrance once back', async ({
    context,
    startChaosServer,
  }) => {
    const outputProxy = await startConnectionProxy(outputProxyPort, chaosServerPort);
    try {
      // Arrange: a server; the output through a proxy; a lower third taken and on air.
      const server = await startChaosServer('outputDrop', chaosServerPort);
      const itemId = await makeLowerThirdButton(server.port, lowerThirdLabel, personName);
      const output = await openTheProgramOutputAt(context, outputProxy.address);
      await sendCommandOrFail(server.port, { type: 'takeItem', itemId });
      const lowerThirdOnAir = output.page.locator(
        '[data-layer-id="lower-third"] > baja-graphic-lower-third',
      );
      await expect(lowerThirdOnAir, 'the lower third must be on air').toContainText(personName);
      const instanceOnAir = await readInstanceOnProgram(server.port, 'lower-third');

      // Act: the output's link drops; it reconnects by itself.
      outputProxy.dropWebSockets();

      // Assert: the output is connected again, the lower third was there at every frame,
      // and its entrance played once.
      await expect
        .poll(() => outputProxy.countOpenWebSockets(), {
          message: 'the output must reconnect by itself',
        })
        .toBe(1);
      await expect
        .poll(
          () => output.logLines.filter((line) => line.message === 'connected to the server').length,
          { message: 'the output must have said it is connected again' },
        )
        .toBe(2);
      await expect(lowerThirdOnAir, 'the lower third must still be on air').toContainText(
        personName,
      );
      await expectTheInstanceStayedOnAirUntouched(
        output,
        'lower-third',
        instanceOnAir?.id ?? 'no lower third on air',
        "the output's link dropped and came back",
      );
    } finally {
      await outputProxy.stop();
    }
  });
});

test.describe('a console offline for a minute', () => {
  test('says it is reconnecting, and shows what the other operator put on air once back', async ({
    context,
    startChaosServer,
  }) => {
    const firstConsoleProxy = await startConnectionProxy(firstConsoleProxyPort, chaosServerPort);
    try {
      // Arrange: a server with a "Tarja" button; the first console through a proxy, the
      // second straight on the server.
      const server = await startChaosServer('consoleOffline', chaosServerPort);
      await makeLowerThirdButton(server.port, lowerThirdLabel, personName);
      const firstConsole = await openTheConsoleAt(context, firstConsoleProxy.address);
      const secondConsole = await openTheConsoleAt(context, server.address);

      // Act: the first console goes offline; the second operator takes the lower third;
      // a minute later the first console is back online.
      firstConsoleProxy.goOffline();
      await expect(
        findConnectionBadge(firstConsole),
        'the offline console must say it is reconnecting',
      ).toHaveText('Reconectando…');
      await fireTheFirstButtonWithKeyOne(secondConsole);
      await expect(
        findLayerRowInCamadas(secondConsole, 'Tarja'),
        'the second console must show its own take',
      ).toContainText(lowerThirdLabel);
      // A fixed wait, the one thing being tested: a minute offline, the brief's length.
      await firstConsole.waitForTimeout(aMinuteOfflineInMilliseconds);
      await expect(
        findLayerRowInCamadas(firstConsole, 'Tarja'),
        'the offline console must not have heard of the take yet',
      ).toContainText('vazia');
      firstConsoleProxy.goOnline();

      // Assert: the first console is connected again and shows the take it missed.
      await waitUntilTheConsoleIsConnected(firstConsole);
      await expect(
        findLayerRowInCamadas(firstConsole, 'Tarja'),
        'the console back online must show what went on air while it was offline',
      ).toContainText(lowerThirdLabel);
    } finally {
      await firstConsoleProxy.stop();
    }
  });
});
