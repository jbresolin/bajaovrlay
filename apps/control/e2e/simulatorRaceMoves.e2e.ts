/**
 * The seeded race simulator, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Every new database has one data source, "Simulador — Enduro", off: a simulated Baja
 *   enduro of 60 cars, so graphics can be built and rehearsed against a moving race with
 *   nobody typing data in. The operator runs it from the "Fontes de dados" page
 *   (#/fontes). This test does what João does on his machine, in a real Chromium against
 *   the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - Set to speed 60 in its "Editar" form and turned on with its switch, the simulator
 *     shows a positions table of 60 cars, and that table changes between two reads of
 *     this run a few seconds apart (at 60× one real second is one simulated minute; the
 *     server polls it every 2 s). The read the test starts from is one that changed after
 *     the switch, so it is never the last data an earlier test left behind.
 *   - Nothing on air changes while it runs: the server has no graphic on its outputs
 *     before nor after (sources are not bound to graphics in this PR).
 *
 * What these tests deliberately do not cover:
 *   - Which car leads or pits when: the race is a pure function of seed and simulated
 *     time, proved in the server's simulateEnduro.test.ts.
 *   - The session card and the standings table: DataSourcesPageDetail.test.tsx.
 *   - What OBS draws: no output page is opened; the server's instances are the truth.
 *
 * What it needs: `pnpm build` (the server registers built graphics only), and a server
 * started for this run: a server reused from an earlier run may have a race already past
 * its checkered flag, where nothing moves any more.
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, and the seeded simulator is turned off with
 *   its default settings back (speed 1, no simulated failure), so this test passes
 *   whatever ran before it, in any order.
 */
import { expect, test } from '@playwright/test';

import {
  carsInTheSeededRace,
  changeSimulatorInItsEditForm,
  countGraphicsOnTheOutputsOfTheRealServer,
  findCarRowsOfPositionsTable,
  findPositionsTableOfSource,
  openDataSourcesPageAndWaitUntilConnected,
  readFirstRowsOfPositionsTable,
  seededSimulatorLabel,
  turnSourceOnWithItsSwitch,
  waitUntilFirstRowsOfPositionsTableDiffer,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The first data comes from the first poll, at once once the source is on; a few seconds
// covers a slow machine.
const waitForTheFirstDataInMilliseconds = 10_000;
// The table is compared over its first ten places: at 60× the leaders cross the line
// every 4 to 7 real seconds, so the gaps and laps there change within a few polls.
const placesComparedBetweenTwoReads = 10;
// How long the test lets the race run before it calls "the table did not change" a
// failure: several polls of 2 s, so one slow poll cannot make it fail.
const waitForTheTableToChangeInMilliseconds = 20_000;
// The test waits for two changes of the table, each up to 20 s, after up to 10 s for the
// first data; Playwright's default of 30 s could stop it before its own clear message, so
// it gets 60 s (it usually needs about 15).
const longestThisTestMayTakeInMilliseconds = 60_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the seeded race simulator', () => {
  test('shows a 60-car race that moves at speed 60, and puts nothing on air', async ({ page }) => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);

    // Arrange: the "Fontes de dados" page, the simulator set to speed 60 in its form,
    // and the server's outputs empty (the reset left them so).
    await openDataSourcesPageAndWaitUntilConnected(page);
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { speedAsTyped: '60' });
    const graphicsOnTheOutputsBefore = await countGraphicsOnTheOutputsOfTheRealServer();

    // Act: turn the simulator on with its switch, and read the table once its 60 cars
    // are shown. That first read may still be the last data an earlier test left (the
    // reset keeps it, and a source that is off shows it), so the test waits for the
    // table to change once, and takes the changed read, this run's data, as its reference.
    await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
    const positionsTable = findPositionsTableOfSource(page, seededSimulatorLabel);
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the simulator must show a positions table of 60 cars',
    ).toHaveCount(carsInTheSeededRace, { timeout: waitForTheFirstDataInMilliseconds });
    const readRightAfterTurningOn = await readFirstRowsOfPositionsTable(
      page,
      seededSimulatorLabel,
      placesComparedBetweenTwoReads,
    );
    const readOfThisRun = await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: seededSimulatorLabel,
      rowCount: placesComparedBetweenTwoReads,
      earlierRead: readRightAfterTurningOn,
      failureMessage: 'at speed 60 the first places of the table must change within a few polls',
      timeoutInMilliseconds: waitForTheTableToChangeInMilliseconds,
    });

    // Assert: a later read of the same places differs from this run's read (the race
    // moved on between two polls of this run), the table still lists 60 cars, and the
    // server's outputs are as empty as before.
    await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: seededSimulatorLabel,
      rowCount: placesComparedBetweenTwoReads,
      earlierRead: readOfThisRun,
      failureMessage: 'at speed 60 the race must move on again from one poll of this run',
      timeoutInMilliseconds: waitForTheTableToChangeInMilliseconds,
    });
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the moving race must still list all 60 cars',
    ).toHaveCount(carsInTheSeededRace);
    expect(graphicsOnTheOutputsBefore, 'the reset must leave no graphic on the outputs').toBe(0);
    expect(
      await countGraphicsOnTheOutputsOfTheRealServer(),
      'a running data source must put nothing on air nor in preview',
    ).toBe(0);
  });
});
