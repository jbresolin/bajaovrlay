/**
 * Chaos: a fastest lap arrives during the podium, with "Pausar gatilhos" on (apps/control, Playwright)
 *
 * What this module is for:
 *   During a podium or an interview the operator presses "Pausar gatilhos" so that nothing
 *   goes on air by itself. A new fastest lap, whose rule says auto, used to go on air for
 *   8 s anyway; since BAJAOVRLAY-73 it waits in "Eventos" for the operator instead, and
 *   says why. This is the incident report of that moment: what the operator sees, what
 *   the air shows, and what "No ar" does.
 *
 * What these tests prove:
 *   - Paused from the console's menu, the header says "Gatilhos e eventos automáticos
 *     pausados"; the simulator's race gives a fastest lap, which waits in "Eventos" with
 *     "chegou durante a pausa", and the output's notice layer shows nothing, not
 *     even for a frame.
 *   - "No ar" on its row puts it on the notice layer, with one entrance.
 *
 * What these tests deliberately do not cover:
 *   - Resuming replays nothing, an event queued at the pause, the maximum wait: the server's
 *     pauseHoldsAutomaticEventsOnTheStore.test.ts, on a clock moved by hand.
 *   - The row's words for each reason: HeldByThePauseRow.test.tsx.
 */
import { readWhatLayerShowed } from '../../../renderer/e2e/whatEachLayerShowed';
import { chaosServerPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import { openTheConsoleAt, openTheProgramOutputAt } from './steps/pagesOfTheShow';
import {
  readInstanceOnProgram,
  readStateOfTheChaosServer,
  sendCommandOrFail,
  waitUntilTheSourceIsHealthy,
} from './steps/showOnTheChaosServer';
import { countEntrancesOnLayer } from './steps/whatTheAirShowed';

const seededSimulatorId = 'simulador-enduro';
const seededSimulatorLabel = 'Simulador — Enduro';

// At 60× the first laps end about 4.5 simulated minutes in (about 5 s), and the session's
// first best lap gives a fastest lap; 30 s leaves room on a slow machine.
const waitForAFastestLapInMilliseconds = 30_000;
// The notice must reach the air well within this after "No ar".
const waitForTheNoticeInMilliseconds = 10_000;
// Starting the server, the race, a fastest lap and the notice; a minute and a half at most.
const longestThisScenarioMayTakeInMilliseconds = 90_000;

test.describe('a fastest lap arrives while "Pausar gatilhos" is on', () => {
  test('waits in "Eventos" saying why, nothing reaches the air by itself, and "No ar" puts it on', async ({
    context,
    startChaosServer,
  }) => {
    test.setTimeout(longestThisScenarioMayTakeInMilliseconds);

    // Arrange: a new database (fastest laps auto, 8 s, with the seeded "Volta mais
    // rápida"), the simulator at 60×, read every 0,5 s, on; the output and the console open;
    // the operator pauses from the menu before the race starts.
    const server = await startChaosServer('pauseHoldsTheFastestLap', chaosServerPort);
    await sendCommandOrFail(server.port, {
      type: 'updateDataSource',
      sourceId: seededSimulatorId,
      pollIntervalMs: 500,
      config: { speed: 60 },
    });
    const output = await openTheProgramOutputAt(context, server.address);
    const consolePage = await openTheConsoleAt(context, server.address);
    await consolePage.getByRole('button', { name: 'Menu' }).click();
    await consolePage.getByRole('menuitem', { name: 'Pausar gatilhos' }).click();
    await expect(
      consolePage.getByText('Gatilhos e eventos automáticos pausados'),
      'the header must say what the pause holds',
    ).toBeVisible();
    await consolePage.getByRole('tab', { name: /^Eventos/ }).click();

    // Act: the race starts, and gives a fastest lap.
    await sendCommandOrFail(server.port, {
      type: 'setDataSourceEnabled',
      sourceId: seededSimulatorId,
      isEnabled: true,
    });
    await sendCommandOrFail(server.port, {
      type: 'restartSimulatedRace',
      sourceId: seededSimulatorId,
    });
    await waitUntilTheSourceIsHealthy(server.port, seededSimulatorLabel);
    const heldFastestLapRow = consolePage
      .getByRole('list', { name: 'Eventos esperando' })
      .getByRole('listitem')
      .filter({ hasText: 'Volta mais rápida' })
      .first();
    await expect(heldFastestLapRow, 'the fastest lap must wait in "Eventos"').toBeVisible({
      timeout: waitForAFastestLapInMilliseconds,
    });

    // Assert: it says why it waits, the server holds it pending, and the notice layer of
    // the output showed nothing at any frame.
    await expect(heldFastestLapRow, 'its row must say why it waits').toContainText(
      'chegou durante a pausa',
    );
    const stateWhilePaused = await readStateOfTheChaosServer(server.port);
    const heldFastestLaps = stateWhilePaused.events.filter((event) => event.kind === 'fastestLap');
    expect(heldFastestLaps.length, 'at least one fastest lap must have arrived').toBeGreaterThan(0);
    for (const heldFastestLap of heldFastestLaps) {
      expect(
        { status: heldFastestLap.status, heldByThePause: heldFastestLap.heldByThePause },
        'every fastest lap must wait for the operator, held by the pause',
      ).toEqual({ status: 'pending', heldByThePause: 'arrivedWhilePaused' });
    }
    const noticeFramesWhilePaused = await readWhatLayerShowed(output.page, 'notice', {});
    expect(
      noticeFramesWhilePaused.filter((frame) => frame !== 'nothing'),
      'nothing may reach the notice layer by itself while paused, not even for a frame',
    ).toEqual([]);

    // Act: the operator presses "No ar" on the fastest lap's row.
    await heldFastestLapRow.getByRole('button', { name: 'No ar' }).click();

    // Assert: a held fastest lap is on the notice layer, its entrance played once.
    await expect
      .poll(async () => (await readInstanceOnProgram(server.port, 'notice'))?.graphicId, {
        message: '"No ar" must put the fastest lap on the notice layer',
        timeout: waitForTheNoticeInMilliseconds,
      })
      .toBe('notice');
    const stateAfterThePress = await readStateOfTheChaosServer(server.port);
    const fastestLapOnAir = stateAfterThePress.events.find((event) => event.status === 'onAir');
    expect(
      { kind: fastestLapOnAir?.kind, heldByThePause: fastestLapOnAir?.heldByThePause },
      'the event on air must be the held fastest lap',
    ).toEqual({ kind: 'fastestLap', heldByThePause: 'arrivedWhilePaused' });
    await expect
      .poll(() => countEntrancesOnLayer(output.logLines, 'notice'), {
        message: 'the notice must play its entrance once on the output',
        timeout: waitForTheNoticeInMilliseconds,
      })
      .toBe(1);
  });
});
