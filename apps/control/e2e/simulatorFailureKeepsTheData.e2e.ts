/**
 * A failing source keeps its last data, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   When a data source stops answering, nothing it fed may go blank (rule 4): the server
 *   keeps the last good data and marks the source late ("Atrasada"). The simulator has a
 *   "Falha simulada" switch in its "Editar" form that makes every poll fail on purpose,
 *   so the operator can rehearse exactly that. This test flips it in a real Chromium
 *   against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - With "Falha simulada" on, the simulator's chip reads "Atrasada", the banner says the
 *     data is late, and the positions table still lists the 60 cars of its last data,
 *     unchanged over several polls.
 *   - With "Falha simulada" off again, the next good poll brings the chip back to "Ok"
 *     and the banner goes away.
 *
 * What these tests deliberately do not cover:
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
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The server polls the simulator every 2 s: a change of health shows at the next poll,
// so a few polls cover a slow machine.
const waitForTheNextPollsInMilliseconds = 10_000;
// How long the late data is watched to stay put: more than two polls of 2 s.
const timeToSeeThatTheDataIsKeptInMilliseconds = 5_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a simulated failure of the seeded simulator', () => {
  test('turns the chip "Atrasada" and keeps the last data in the table', async ({ page }) => {
    // Arrange: the simulator on at speed 60, with its 60 cars shown and the chip "Ok".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { speedAsTyped: '60' });
    await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
    const simulatorRow = findDataSourceRow(page, seededSimulatorLabel);
    const positionsTable = findPositionsTableOfSource(page, seededSimulatorLabel);
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the simulator must show its 60 cars before the failure',
    ).toHaveCount(carsInTheSeededRace, { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'a simulator answering must read "Ok" before the failure',
    ).toHaveText('Ok');

    // Act: switch "Falha simulada" on in its "Editar" form.
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: true });

    // Assert: the chip turns "Atrasada" at the next poll, the banner says the data is
    // late, and the table keeps its 60 cars, unchanged while the polls keep failing.
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
    await page.waitForTimeout(timeToSeeThatTheDataIsKeptInMilliseconds);
    expect(
      await readFirstRowsOfPositionsTable(page, seededSimulatorLabel, carsInTheSeededRace),
      'failed polls must neither blank nor change the last good data',
    ).toEqual(lateData);
  });

  test('recovers to "Ok" once the failure is switched off', async ({ page }) => {
    // Arrange: the simulator on at speed 60, its 60 cars shown, then failing on purpose
    // until its chip reads "Atrasada".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { speedAsTyped: '60' });
    await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
    const simulatorRow = findDataSourceRow(page, seededSimulatorLabel);
    const positionsTable = findPositionsTableOfSource(page, seededSimulatorLabel);
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the simulator must show its 60 cars before the failure',
    ).toHaveCount(carsInTheSeededRace, { timeout: waitForTheNextPollsInMilliseconds });
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: true });
    await expect(
      findStatusChipOfSourceRow(simulatorRow),
      'the simulator must be late before the recovery',
    ).toHaveText(/^Atrasada/, { timeout: waitForTheNextPollsInMilliseconds });

    // Act: switch "Falha simulada" off again.
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: false });

    // Assert: the next good poll brings the chip back to "Ok", the banner goes away, and
    // the table still lists the 60 cars.
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
