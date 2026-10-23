/**
 * The event inbox with the simulator, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   João's walk of BAJAOVRLAY-44: the simulator at 60× gives a penalty and new fastest
 *   laps; the penalty waits in the "Eventos" tab of the console until he presses "No ar",
 *   then shows on the notice layer and leaves after its rule's time; a fastest lap goes on
 *   air by itself. In a real Chromium against the real server and a real SQLite file.
 *
 * The seed: 227. The simulated race direction gives its first incident, always a penalty,
 * 3.06 simulated minutes after the green flag (about 3 s at 60×); the default seed 2027
 * gives it at 16.7 minutes. Found with drawIncidentScheduleOfRace over the seeds 1 to 300.
 *
 * What these tests prove:
 *   - With fastest laps and leader changes held for the operator, the penalty appears in
 *     "Eventos" as waiting and nothing reaches the notice layer by itself; "No ar" puts the
 *     penalty's notice on air, and it leaves after its rule's time (2 s in the test, set in
 *     "Regras"), the event then shown.
 *   - With fastest laps on air by themselves (the default), a fastest lap of the restarted
 *     race reaches the notice layer with nobody pressing anything.
 *
 * What these tests deliberately do not cover:
 *   - A server restart: this harness shares one server among every test file, so the
 *     restart is eventInboxAfterARestart.e2e.ts, on a server of its own.
 *   - What OBS draws: no output page is opened; the server's instances are the truth (the
 *     notice's look is packages/graphics/notice's screenshots).
 *   - The badge's sound: Chromium plays it only after a click on the page, and nothing
 *     reads a sound back; EventsTabAlert.test.tsx covers when it plays.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, the notice too).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, the event rules put back to their defaults with
 *   no item and every waiting event dismissed, so this test passes whatever ran before it.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  changeSimulatorInItsEditForm,
  openDataSourcesPageAndWaitUntilConnected,
  pollIntervalOfTheTestsAsTyped,
  restartTheSimulatedRaceWithItsButton,
  seededSimulatorLabel,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import {
  createNoticeItemsOnTheServer,
  readEventIdOnTheNoticeLayer,
  readInboxStateOfTheServerOnPort,
  sendCommandOrFail,
} from './eventInboxOnTheRealServer';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';

/** The seed whose first penalty comes 3 simulated minutes in (see the header). */
const seedWithAnEarlyPenaltyAsTyped = '227';

// Up to 10 s for the first data, then about 3 s of race for the penalty, at a poll every
// 0,5 s; 30 s leaves room on a slow machine before its clear message.
const waitForThePenaltyInMilliseconds = 30_000;
// The first laps of the restarted race end about 4.5 simulated minutes in (~5 s), and the
// first best lap of the session fires a fastest lap; 30 s leaves room.
const waitForAFastestLapInMilliseconds = 30_000;
// The notice's rule keeps it on air 2 s; it must be gone within 10.
const waitForTheNoticeToLeaveInMilliseconds = 10_000;
const longestThisTestMayTakeInMilliseconds = 120_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/**
 * Starts the seeded simulator on seed 227 at speed 60, read every 0,5 s, from the green
 * flag, from the "Fontes de dados" page; then opens the console.
 */
async function startTheSimulatorWithAnEarlyPenalty(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
    pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
    speedAsTyped: '60',
    seedAsTyped: seedWithAnEarlyPenaltyAsTyped,
  });
  await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
  await restartTheSimulatedRaceWithItsButton(page, seededSimulatorLabel);
  await openControlPageAndWaitUntilConnected(page);
}

test.describe('the event inbox with the simulator', () => {
  test('keeps the penalty waiting until "No ar", then shows it for its rule\'s time', async ({
    page,
  }) => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);

    // Arrange: the notice items, the incidents shown with the penalty item for 2 s, fastest
    // laps and leader changes held for the operator (so nothing reaches the notice layer by
    // itself), and the simulator started on its early penalty.
    const { penaltyItemId } = await createNoticeItemsOnTheServer(realServerPort);
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'newIncident',
      itemId: penaltyItemId,
      durationMs: 2_000,
    });
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'fastestLap',
      mode: 'ask',
    });
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'leaderChanged',
      mode: 'ignore',
    });
    await startTheSimulatorWithAnEarlyPenalty(page);
    await page.getByRole('tab', { name: /^Eventos/ }).click();

    // Act 1: wait for the penalty to wait in "Eventos".
    const penaltyRow = page
      .getByRole('list', { name: 'Eventos esperando' })
      .getByRole('listitem')
      .filter({ hasText: 'Penalidade' })
      .first();
    await expect(penaltyRow, 'the penalty must arrive in "Eventos"').toBeVisible({
      timeout: waitForThePenaltyInMilliseconds,
    });

    // Assert 1: it waits, and nothing is on the notice layer.
    const stateWithThePenaltyWaiting = await readInboxStateOfTheServerOnPort(realServerPort);
    const penaltyEvent = stateWithThePenaltyWaiting.events.find(
      (event) => event.kind === 'newIncident' && event.status === 'pending',
    );
    expect(penaltyEvent, 'the penalty must be pending on the server').toBeDefined();
    expect(
      await readEventIdOnTheNoticeLayer(realServerPort),
      'nothing may reach the notice layer before "No ar"',
    ).toBe(undefined);
    await expect(
      page.getByTestId('pending-events-badge'),
      'the tab counts what waits',
    ).toBeVisible();

    // Act 2: press "No ar" on it.
    await penaltyRow.getByRole('button', { name: 'No ar' }).click();

    // Assert 2: its notice reaches the notice layer, then leaves by itself, and the event
    // is shown.
    await expect
      .poll(() => readEventIdOnTheNoticeLayer(realServerPort), {
        message: 'the penalty must go on air on the notice layer',
        timeout: waitForTheNoticeToLeaveInMilliseconds,
      })
      .toBe(penaltyEvent?.eventId);
    await expect
      .poll(() => readEventIdOnTheNoticeLayer(realServerPort), {
        message: "the notice must leave after its rule's 2 s",
        timeout: waitForTheNoticeToLeaveInMilliseconds,
      })
      .toBe(undefined);
    const stateAfter = await readInboxStateOfTheServerOnPort(realServerPort);
    expect(
      stateAfter.events.find((event) => event.eventId === penaltyEvent?.eventId)?.status,
      'the penalty was shown once',
    ).toBe('shown');
  });

  test('puts a fastest lap on air by itself', async ({ page }) => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);

    // Arrange: fastest laps shown by themselves (the default mode) with the fastest-lap
    // item, 2 s each; leader changes ignored, so the layer is the fastest laps' alone.
    const { fastestLapItemId } = await createNoticeItemsOnTheServer(realServerPort);
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'fastestLap',
      mode: 'auto',
      itemId: fastestLapItemId,
      durationMs: 2_000,
    });
    await sendCommandOrFail(realServerPort, {
      type: 'updateEventRule',
      kind: 'leaderChanged',
      mode: 'ignore',
    });

    // Act: start the race, and press nothing.
    await startTheSimulatorWithAnEarlyPenalty(page);

    // Assert: a fastest lap reaches the notice layer by itself.
    await expect
      .poll(async () => (await readEventIdOnTheNoticeLayer(realServerPort)) ?? '', {
        message: 'a fastest lap must go on air with nobody pressing anything',
        timeout: waitForAFastestLapInMilliseconds,
      })
      .toContain(':fastestLap:');
  });
});
