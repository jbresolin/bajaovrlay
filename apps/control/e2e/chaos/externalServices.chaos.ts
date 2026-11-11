/**
 * Chaos: OBS and the Super Chat feed go away (apps/control, Playwright)
 *
 * What this module is for:
 *   The server talks to two outside services during a show: OBS (scene switches, the
 *   tally) and the live chat that brings Super Chats. Either can disappear: OBS restarted
 *   by the director, the stream's chat ended or out of quota. The promise: the operator is
 *   told, only what needs that service stops, nothing else waits for it, and nothing on air
 *   changes because of it.
 *
 * What these tests prove:
 *   - OBS goes away (the fake OBS of apps/server's tests, closed as OBS closes): the tally
 *     says "Sem conexão"; a lower third taken meanwhile goes on air at once; a macro whose
 *     first step switches the scene stops there, says "Parou no passo 1" with OBS's reason,
 *     and puts nothing after it on air. OBS back: the tally shows its scene again, and the
 *     same macro switches the scene and takes its item.
 *   - The Super Chat feed fails with Super Chats waiting for approval: they stay waiting,
 *     the source reads late, and nothing goes on air by itself.
 *
 * What these tests deliberately do not cover:
 *   - YouTube itself, its quota and its ended chat: the server reads YouTube's address
 *     fixed in its code, and docs/ci.md allows no server setting for tests only, so a
 *     server process cannot be pointed at a fake YouTube. Its failure is played here by the
 *     simulator's Super Chats with "Falha simulada", which goes through the same source,
 *     inbox and rules; the YouTube adapter's own answers to "quotaExceeded" and to an ended
 *     chat are proven against the fake YouTube by its Vitest tests (youtubeLiveChat/).
 *   - OBS frozen rather than closed (it takes the connection and never answers): obs's
 *     Vitest tests.
 */
import { type Page } from '@playwright/test';

import { obsPasswordOfTheStreamPc } from '../../../server/src/modules/obs/fakeObsPasswords.testSupport';
import { openFakeObs } from '../../../server/src/modules/obs/openFakeObs.testSupport';
import { chaosServerPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  findLayerRowInCamadas,
  fireTheFirstButtonWithKeyOne,
  openTheConsoleAt,
  openTheProgramOutputAt,
} from './steps/pagesOfTheShow';
import {
  makeLowerThirdButton,
  makeMacro,
  readInstanceOnProgram,
  readStateOfTheChaosServer,
  sendCommandOrFail,
  waitUntilTheSourceIsHealthy,
  waitUntilTheSourceIsLateBecause,
} from './steps/showOnTheChaosServer';
import { countEntrancesOnLayer } from './steps/whatTheAirShowed';

const seededSimulatorId = 'simulador-enduro';
const seededSimulatorLabel = 'Simulador — Enduro';

/** Finds the OBS tally in the console's header. */
function findObsTally(consolePage: Page) {
  return consolePage.getByRole('status', { name: 'OBS' });
}

test.describe('OBS goes away mid-show', () => {
  test('the tally says so, takes do not wait, a macro with a scene step stops there; back, both work', async ({
    context,
    startChaosServer,
  }) => {
    const fakeObs = await openFakeObs({
      password: obsPasswordOfTheStreamPc,
      sceneNames: ['Câmera da pista', 'Box', 'Pódio'],
      programSceneName: 'Câmera da pista',
      isStudioModeOn: false,
      previewSceneName: 'Câmera da pista',
    });
    try {
      // Arrange: the server connected to OBS; a "Tarja" button (key 1); a macro "Ir para o
      // box": the scene "Box", then the team chief's lower third; the output; the console.
      const server = await startChaosServer('obsGoesAway', chaosServerPort, {
        BAJAOVRLAY_OBS_URL: fakeObs.address,
        BAJAOVRLAY_OBS_PASSWORD: obsPasswordOfTheStreamPc,
      });
      await makeLowerThirdButton(server.port, 'Tarja — capitã da UFPR', 'Ana Souza');
      const chiefItemId = await makeLowerThirdButton(
        server.port,
        'Tarja — chefe da UFSC',
        'Bruno Lima',
      );
      const macroId = await makeMacro(server.port, 'Ir para o box', [
        { kind: 'obsScene', sceneName: 'Box' },
        { kind: 'takeItem', itemId: chiefItemId },
      ]);
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, server.address);
      await expect(findObsTally(consolePage), 'the tally must show OBS connected').toContainText(
        'Programa: Câmera da pista',
      );

      // Act: OBS closes; the operator takes the lower third; the macro is run.
      fakeObs.close();
      await expect(findObsTally(consolePage), 'the tally must say OBS is gone').toContainText(
        'Sem conexão',
      );
      await fireTheFirstButtonWithKeyOne(consolePage);
      await expect(
        output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
        'a take must not wait for OBS',
      ).toContainText('Ana Souza');
      await sendCommandOrFail(server.port, { type: 'runMacro', macroId });

      // Assert: the macro stopped at its scene step with OBS's reason, and its take did
      // not happen; the console's macro says "Parou no passo 1".
      await expect
        .poll(async () => (await readStateOfTheChaosServer(chaosServerPort)).macroStops, {
          message: 'the macro must stop at its scene step',
        })
        .toEqual([
          expect.objectContaining({
            macroId,
            stepIndex: 0,
            reason: expect.stringContaining('O OBS não está conectado.'),
          }),
        ]);
      expect(
        (await readInstanceOnProgram(chaosServerPort, 'lower-third'))?.itemId,
        'nothing after the stopped step may go on air',
      ).not.toBe(chiefItemId);
      const quickFireArea = consolePage.getByRole('region', { name: 'Atalhos e macros' });
      await quickFireArea.getByRole('tab', { name: 'Macros' }).click();
      await expect(quickFireArea, 'the macro must say where it stopped').toContainText(
        'Parou no passo 1',
      );

      // Act: OBS opens again; once the tally shows its scene, the macro is run again.
      fakeObs.reopen();
      await expect(
        findObsTally(consolePage),
        'the server must reconnect to OBS by itself (every 5 s)',
      ).toContainText('Programa: Câmera da pista', { timeout: 15_000 });
      await sendCommandOrFail(server.port, { type: 'runMacro', macroId });

      // Assert: the scene switched, the tally follows, and the chief is on air.
      await expect(findObsTally(consolePage), 'the tally must show the new scene').toContainText(
        'Programa: Box',
      );
      await expect(
        output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
        'the macro must take its item once OBS is back',
      ).toContainText('Bruno Lima');
      expect(
        countEntrancesOnLayer(output.logLines, 'lower-third'),
        "two takes on the lower third: the operator's, then the macro's, once each",
      ).toBe(2);
    } finally {
      await fakeObs.closeForGood();
    }
  });
});

test.describe('the Super Chat feed fails with Super Chats waiting', () => {
  test('keeps them waiting for approval, reads late, and puts nothing on air', async ({
    context,
    startChaosServer,
  }) => {
    // Arrange: the simulator at 60× with its Super Chats on (about one every 5 s), read
    // every 0,5 s, its race started; the output; the console; wait for two Super Chats.
    // The seeded "fastest lap" rule puts every fastest lap on air by itself; it is set to
    // ignore, so whatever plays on air here could only come from the failure.
    const server = await startChaosServer('superChatFeedFails', chaosServerPort);
    await sendCommandOrFail(server.port, {
      type: 'updateEventRule',
      kind: 'fastestLap',
      mode: 'ignore',
      durationMs: 8_000,
      maxAgeMs: 120_000,
      itemId: null,
    });
    await sendCommandOrFail(server.port, {
      type: 'updateDataSource',
      sourceId: seededSimulatorId,
      pollIntervalMs: 500,
      config: { speed: 60, areSuperChatsSimulated: true },
    });
    await sendCommandOrFail(server.port, {
      type: 'setDataSourceEnabled',
      sourceId: seededSimulatorId,
      isEnabled: true,
    });
    await sendCommandOrFail(server.port, {
      type: 'restartSimulatedRace',
      sourceId: seededSimulatorId,
    });
    const output = await openTheProgramOutputAt(context, server.address);
    const consolePage = await openTheConsoleAt(context, server.address);
    const readWaitingSuperChatIds = async () =>
      (await readStateOfTheChaosServer(chaosServerPort)).events
        .filter((event) => event.kind === 'superChat' && event.status === 'pending')
        .map((event) => event.eventId);
    await expect
      .poll(async () => (await readWaitingSuperChatIds()).length, {
        message: 'two Super Chats must be waiting for approval',
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(2);

    // Act: the feed fails.
    await sendCommandOrFail(server.port, {
      type: 'updateDataSource',
      sourceId: seededSimulatorId,
      pollIntervalMs: 500,
      config: { speed: 60, areSuperChatsSimulated: true, isFailing: true },
    });
    await waitUntilTheSourceIsLateBecause(server.port, seededSimulatorLabel, /^Falha simulada\.$/);
    const waitingWhenItFailed = await readWaitingSuperChatIds();

    // Assert: a few failed polls later the same Super Chats still wait, the console's
    // inbox still lists them, the chip says late, and no layer of the output played.
    await expect
      .poll(
        async () =>
          (await readStateOfTheChaosServer(chaosServerPort)).dataSources.find(
            (source) => source.id === seededSimulatorId,
          )?.status.consecutiveFailures ?? 0,
        { message: 'the feed must fail several polls in a row' },
      )
      .toBeGreaterThanOrEqual(4);
    expect(
      await readWaitingSuperChatIds(),
      'every Super Chat waiting when the feed failed must still be waiting',
    ).toEqual(waitingWhenItFailed);
    // The tab counts every event waiting: the Super Chats, and any penalty of the race, so
    // its count is at least the Super Chats still waiting.
    const eventsTab = consolePage.getByRole('tab', { name: /^Eventos \d+ eventos? esperando$/ });
    await expect(
      eventsTab,
      'the console must still show events waiting on its "Eventos" tab',
    ).toBeVisible();
    const eventsTabName =
      (await eventsTab.getAttribute('aria-label')) ?? (await eventsTab.textContent()) ?? '';
    const countOnTheTab = Number(/Eventos\s*(\d+)/.exec(eventsTabName)?.[1] ?? 'NaN');
    expect(
      countOnTheTab,
      `the "Eventos" tab must count at least the ${String(waitingWhenItFailed.length)} Super Chats waiting (it reads "${eventsTabName}")`,
    ).toBeGreaterThanOrEqual(waitingWhenItFailed.length);
    await expect(
      consolePage.getByRole('status', { name: /^Saúde das fontes de dados/ }),
      'the header chip must count the feed as late',
    ).toHaveText('Fontes: 1 atrasada');
    const entrancesOnTheOutput = output.logLines.filter(
      (line) => line.message === 'graphic lifecycle call' && line.action === 'playAction',
    );
    expect(entrancesOnTheOutput, 'nothing may have gone on air by itself').toEqual([]);
    await expect(
      findLayerRowInCamadas(consolePage, 'Aviso'),
      'the notice layer must stay empty',
    ).toContainText('vazia');

    // Act: the feed is back.
    await sendCommandOrFail(server.port, {
      type: 'updateDataSource',
      sourceId: seededSimulatorId,
      pollIntervalMs: 500,
      config: { speed: 60, areSuperChatsSimulated: true, isFailing: false },
    });

    // Assert: the source is healthy again, and the Super Chats are still waiting.
    await waitUntilTheSourceIsHealthy(server.port, seededSimulatorLabel);
    const waitingNow = await readWaitingSuperChatIds();
    expect(
      waitingWhenItFailed.every((eventId) => waitingNow.includes(eventId)),
      'the Super Chats waiting before the failure must still be waiting once the feed is back',
    ).toBe(true);
  });
});
