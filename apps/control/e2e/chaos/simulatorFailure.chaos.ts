/**
 * Chaos: the simulator fails mid-race (apps/control, Playwright)
 *
 * What this module is for:
 *   The seeded "Simulador — Enduro" stands in for the timing system at rehearsals, and its
 *   "Falha simulada" switch is how an operator rehearses a feed that breaks. The same
 *   promise as for the Baja app's source (bajaAppSourceFailures.chaos.ts) must hold for it:
 *   the tower on air keeps its rows, the console says the source is late, and when the
 *   failure is switched off the source is ok again with no jump on air.
 *
 * What these tests prove:
 *   - With "Falha simulada" on, the server says "Falha simulada.", the tower on air keeps
 *     its rows, the header chip counts the source as late and "Verificar servidor" names it.
 *   - Switched off, the source is ok again, and from the take to the end the tower's layer
 *     showed the same graphic at every frame, played its entrance once, and never showed
 *     fewer rows than before the failure, not even for a frame.
 *
 * What these tests deliberately do not cover:
 *   - That the race moved on while it failed: the simulator computes the race from the
 *     clock, so the rows after the failure are those of "now", as a real timing system's
 *     would be (simulatorAdapter's tests).
 *   - The "Fontes" page's own row: simulatorFailureKeepsTheData.e2e.ts.
 */
import { type Page } from '@playwright/test';

import { chaosServerPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  checkTheServerFromTheMenu,
  openTheConsoleAt,
  openTheProgramOutputAt,
} from './steps/pagesOfTheShow';
import {
  readInstanceOnProgram,
  sendCommandOrFail,
  takeTowerReadingTheSource,
  waitUntilTheSourceIsHealthy,
  waitUntilTheSourceIsLateBecause,
} from './steps/showOnTheChaosServer';
import {
  expectTheInstanceStayedOnAirUntouched,
  expectTheTowerNeverLostARow,
} from './steps/whatTheAirShowed';

const seededSimulatorId = 'simulador-enduro';
const seededSimulatorLabel = 'Simulador — Enduro';

/** Counts the tower's rows on the output: the places it shows. */
async function countRowsOfTheTowerOnTheOutput(outputPage: Page): Promise<number> {
  return outputPage
    .locator('[data-layer-id="tower"] > baja-graphic-positions-tower')
    .locator('[data-testid="positions-tower-row"]:not(.is-leaving)')
    .count();
}

/** Switches "Falha simulada" on or off, every other setting at its default, read every 0,5 s. */
async function setSimulatedFailure(port: number, isFailing: boolean): Promise<void> {
  await sendCommandOrFail(port, {
    type: 'updateDataSource',
    sourceId: seededSimulatorId,
    pollIntervalMs: 500,
    config: { isFailing },
  });
}

test.describe('the simulator fails while the tower is on air', () => {
  test('keeps the tower and says the source is late with "Falha simulada", and is ok again when it is switched off', async ({
    context,
    startChaosServer,
  }) => {
    // Arrange: a server with the seeded simulator on, read every 0,5 s, its race started;
    // the output and the console open; a tower reading the simulator taken.
    const server = await startChaosServer('simulatorFailure', chaosServerPort);
    await setSimulatedFailure(server.port, false);
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
    const output = await openTheProgramOutputAt(context, server.address);
    const consolePage = await openTheConsoleAt(context, server.address);
    await takeTowerReadingTheSource(server.port, seededSimulatorId);
    await expect
      .poll(() => countRowsOfTheTowerOnTheOutput(output.page), {
        message: 'the tower on air must show the race before the failure',
      })
      .toBeGreaterThan(0);
    const rowsBeforeTheFailure = await countRowsOfTheTowerOnTheOutput(output.page);
    const towerOnAir = await readInstanceOnProgram(server.port, 'tower');

    // Act: "Falha simulada" on.
    await setSimulatedFailure(server.port, true);

    // Assert: late for that reason, the tower still full on air, the console says so.
    await waitUntilTheSourceIsLateBecause(server.port, seededSimulatorLabel, /^Falha simulada\.$/);
    expect(
      await countRowsOfTheTowerOnTheOutput(output.page),
      'the tower on air must keep every row while the simulator fails',
    ).toBe(rowsBeforeTheFailure);
    await expect(
      consolePage.getByRole('status', { name: /^Saúde das fontes de dados/ }),
      'the header chip must count the simulator as late',
    ).toHaveText('Fontes: 1 atrasada');
    await expect(
      await checkTheServerFromTheMenu(consolePage),
      '"Verificar servidor" must name the late simulator',
    ).toContainText(`Fontes atrasadas: ${seededSimulatorLabel}.`);

    // Act: "Falha simulada" off.
    await setSimulatedFailure(server.port, false);

    // Assert: ok again, and the tower on air never blanked nor played its entrance again.
    await waitUntilTheSourceIsHealthy(server.port, seededSimulatorLabel);
    await expect(
      consolePage.getByRole('status', { name: /^Saúde das fontes de dados/ }),
      'the header chip must count the simulator as ok again',
    ).toHaveText('Fontes: 1 ok');
    await expectTheInstanceStayedOnAirUntouched(
      output,
      'tower',
      towerOnAir?.id ?? 'no tower on air',
      'the simulator failed and came back',
    );
    await expectTheTowerNeverLostARow(
      output,
      rowsBeforeTheFailure,
      'the simulator failed and came back',
    );
  });
});
