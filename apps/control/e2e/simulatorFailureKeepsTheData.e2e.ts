/**
 * A failing source keeps its last data, then recovers, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   When a data source stops answering, nothing it fed may go blank (rule 4): the server
 *   keeps the last good data and marks the source late ("Atrasada"). The simulator has a
 *   "Falha simulada" switch in its "Editar" form that makes every poll fail on purpose,
 *   so the operator can rehearse exactly that, and then the recovery. This test flips it
 *   on and off in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - With "Falha simulada" on, the simulator's chip reads "Atrasada", the banner says the
 *     data is late, and the positions table still lists the 60 cars of its last data,
 *     unchanged after the server has counted several failed polls in a row.
 *   - With "Falha simulada" off again, the next good poll brings the chip back to "Ok",
 *     the banner goes away, and the table lists the 60 cars.
 *
 * What these tests deliberately do not cover:
 *   - Red "Erro" after a minute of failing (João's ruling 4): the test fails the source
 *     for a few seconds only, far under the minute, so the chip must still read
 *     "Atrasada" when the failure is switched off; the minute is proved with a fake
 *     clock in dataSourceHealth.test.ts.
 *   - The failure reason in the chip's tooltip ("falha simulada"): DataSourcesPage.test.tsx.
 *   - How the server counts failures and when it writes event-log rows:
 *     recordDataSourcePoll.test.ts.
 *   - A source that never had data ("Erro"): dataSourceHealth.test.ts.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, and the seeded simulator is turned off with
 *   its default settings back ("Falha simulada" off), so this test passes whatever ran
 *   before it, in any order.
 */
import { expect, test } from '@playwright/test';

import { waitUntilTheSourceHasFailedPollsInARow } from './dataSourceStateOnTheRealServer';
import {
  carsInTheSeededRace,
  changeSimulatorInItsEditForm,
  findCarRowsOfPositionsTable,
  findDataSourceRow,
  findPositionsTableOfSource,
  findStatusChipOfSourceRow,
  openDataSourcesPageAndWaitUntilConnected,
  readFirstRowsOfPositionsTable,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The server polls the simulator every 0,5 s: a change of health shows at the next poll,
// so a few seconds cover a slow machine.
const waitForTheNextPollsInMilliseconds = 5_000;
// The late data is checked once the server has counted this many failed polls in a row:
// about two seconds of failing at 0,5 s, far under the minute that turns it red.
const failedPollsBeforeTheDataIsChecked = 4;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a simulated failure of the seeded simulator', () => {
  test('turns the chip "Atrasada" keeping the last data, then "Ok" again once switched off', async ({
    page,
  }) => {
    // Arrange: the simulator on at speed 60, read every 0,5 s from the green flag, with
    // its 60 cars shown and the chip "Ok".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    const simulatorRow = findDataSourceRow(page, seededSimulatorLabel);
    const positionsTable = findPositionsTableOfSource(page, seededSimulatorLabel);
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'a simulator answering must read "Ok" before the failure',
    ).toHaveText('Ok', { timeout: waitForTheNextPollsInMilliseconds });

    // Act (1): switch "Falha simulada" on in its "Editar" form.
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: true });

    // Assert (1): the chip turns "Atrasada" at the next poll, the banner says the data is
    // late, and the table keeps its 60 cars, unchanged after several more failed polls.
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'a failing simulator must read "Atrasada"',
    ).toHaveText(/^Atrasada/, { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      page.getByText(/fonte atrasada$/),
      'the data of a late source must carry the "fonte atrasada" banner',
    ).toBeVisible();
    const lateData = await readFirstRowsOfPositionsTable(
      page,
      seededSimulatorLabel,
      carsInTheSeededRace,
    );
    expect(lateData, 'a late source must still show all 60 cars of its last data').toHaveLength(
      carsInTheSeededRace,
    );
    await waitUntilTheSourceHasFailedPollsInARow({
      sourceLabel: seededSimulatorLabel,
      failureCount: failedPollsBeforeTheDataIsChecked,
      failureMessage: 'the server must count several failed polls of the failing simulator',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
    expect(
      await readFirstRowsOfPositionsTable(page, seededSimulatorLabel, carsInTheSeededRace),
      'failed polls must neither blank nor change the last good data',
    ).toEqual(lateData);
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'a few seconds of failing are far under the minute that turns the chip red',
    ).toHaveText(/^Atrasada/);

    // Act (2): switch "Falha simulada" off again.
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: false });

    // Assert (2): the next good poll brings the chip back to "Ok", the banner goes away,
    // and the table still lists the 60 cars.
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'a simulator answering again must read "Ok"',
    ).toHaveText('Ok', { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      page.getByText(/fonte atrasada$/),
      'a recovered source must lose the "fonte atrasada" banner',
    ).toBeHidden();
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the recovered simulator must show its 60 cars',
    ).toHaveCount(carsInTheSeededRace);
  });
});
