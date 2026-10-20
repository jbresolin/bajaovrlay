// Test support: the page steps the data source test files share (simulatorRaceMoves.e2e.ts,
// simulatorFailureKeepsTheData.e2e.ts, recordAndReplay.e2e.ts, dataSourcesPageLayout.e2e.ts,
// dataSourceCardPicking.e2e.ts, emptyServerState.e2e.ts, flexSourceFollowsATimingSystem.e2e.ts): opening the "Fontes de dados" page, finding a source's row
// and its data, reading the positions table, changing a simulator through its "Editar"
// form and restarting its race with "Reiniciar corrida", as an operator does. What the
// tests read from the server's state lives in dataSourceStateOnTheRealServer.ts.
// Functions only; nothing here remembers anything between calls or between tests.
import { expect, type Locator, type Page } from '@playwright/test';

import { readDataSourceFromTheRealServer } from './dataSourceStateOnTheRealServer';
import { seededSimulatorLabel } from './emptyTheServerState';

/**
 * The source every new database has (seeded by the server, off). Declared once, beside
 * the reset that puts it back, and passed on here for the test files.
 */
export { seededSimulatorLabel };

/** The kinds of source "+ Fonte" offers, as its buttons name them. */
export type NewSourceKindButton = 'Simulador' | 'Reprodução' | 'HTTP/JSON (flexível)';

/** How many cars the seeded simulator races with its default settings. */
export const carsInTheSeededRace = 60;

/**
 * The poll interval of the data source tests, as the operator types it: every 0,5 s, the
 * shortest allowed (gate 2 on PR #16), so each wait for "the next poll" is short.
 */
export const pollIntervalOfTheTestsAsTyped = '0,5';

// The first data comes from the first poll, right after the source is turned on; a few
// seconds cover a slow machine.
const waitForTheFirstDataInMilliseconds = 10_000;
// "Reiniciar corrida" is one command; the server answers it within a second.
const waitForTheRestartInMilliseconds = 5_000;

/** Opens the "Fontes de dados" page and waits until it says it is connected to the server. */
export async function openDataSourcesPageAndWaitUntilConnected(page: Page): Promise<void> {
  // Opened by its address, as a new tab from the header's "Fontes" link is: the link
  // itself opens a new tab (João's ruling 2), which dataSourcesPageLayout.e2e.ts checks.
  await page.goto('/#/fontes');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before any source can be shown',
  ).toHaveText('Conectado');
  await expect(
    page.getByRole('heading', { name: 'Fontes de dados' }),
    'the address #/fontes must show the "Fontes de dados" page',
  ).toBeVisible();
}

/** Finds the row of one source in the list, by the label the operator gave it. */
export function findDataSourceRow(page: Page, sourceLabel: string): Locator {
  return page
    .getByRole('list', { name: 'Fontes de dados' })
    .getByRole('listitem', { name: sourceLabel });
}

/**
 * Finds the status chip of a source's row ("Ok", "Atrasada (há 4 s)", "Erro",
 * "Desligada"): the row's first badge; the "Gravando" badge, when shown, comes after it.
 */
export function findStatusChipOfSourceRow(sourceRow: Locator): Locator {
  return sourceRow.locator('[data-slot="badge"]').first();
}

/**
 * Finds the positions table of a source, in the data shown beside the list. Only the
 * selected source's data is shown: the first source until another label is clicked.
 */
export function findPositionsTableOfSource(page: Page, sourceLabel: string): Locator {
  return page
    .getByRole('region', { name: `Dados de ${sourceLabel}` })
    .getByRole('table', { name: 'Posições' });
}

/** Finds the rows of cars in a positions table, without its header row. */
export function findCarRowsOfPositionsTable(positionsTable: Locator): Locator {
  return positionsTable.locator('tbody').getByRole('row');
}

/**
 * Reads the text of the first `rowCount` car rows of a source's positions table, one
 * string per row ("1 12 Carcará Baja UFPR 34 5:12.345 …"), to compare two moments.
 */
export async function readFirstRowsOfPositionsTable(
  page: Page,
  sourceLabel: string,
  rowCount: number,
): Promise<string[]> {
  const carRows = findCarRowsOfPositionsTable(findPositionsTableOfSource(page, sourceLabel));
  const everyRowText = await carRows.allInnerTexts();
  return everyRowText.slice(0, rowCount);
}

/**
 * Waits until the first `rowCount` car rows of a source's positions table differ from
 * `earlierRead`, and returns the read that differed, so a test can wait for one more change.
 */
export async function waitUntilFirstRowsOfPositionsTableDiffer(
  page: Page,
  wait: {
    sourceLabel: string;
    rowCount: number;
    earlierRead: string[];
    failureMessage: string;
    timeoutInMilliseconds: number;
  },
): Promise<string[]> {
  let latestRead = wait.earlierRead;
  await expect
    .poll(
      async () => {
        latestRead = await readFirstRowsOfPositionsTable(page, wait.sourceLabel, wait.rowCount);
        return latestRead;
      },
      { message: wait.failureMessage, timeout: wait.timeoutInMilliseconds },
    )
    .not.toEqual(wait.earlierRead);
  return latestRead;
}

/**
 * Starts a new source as the operator does: "+ Fonte", then the kind's button under
 * "Que tipo de fonte?". Returns the form that opens ("Nova fonte: <kind>"), still empty.
 */
export async function openNewSourceFormOfKind(
  page: Page,
  kindButton: NewSourceKindButton,
): Promise<Locator> {
  await page.getByRole('button', { name: '+ Fonte' }).click();
  await page
    .getByRole('group', { name: 'Que tipo de fonte?' })
    .getByRole('button', { name: kindButton })
    .click();
  return page.getByRole('region', { name: `Nova fonte: ${kindButton}` });
}

/**
 * Turns a source on with the switch "Ligada" of its row, and waits until the switch
 * shows it on, which it does once the server has accepted the command.
 */
export async function turnSourceOnWithItsSwitch(page: Page, sourceLabel: string): Promise<void> {
  const enabledSwitch = findDataSourceRow(page, sourceLabel).getByRole('switch', {
    name: 'Ligada',
  });
  await enabledSwitch.click();
  await expect(
    enabledSwitch,
    `the source "${sourceLabel}" must be on after the switch`,
  ).toBeChecked();
}

/**
 * Changes a simulator through its "Editar" form: the poll interval and the speed typed as
 * the operator types them ("0,5", "60"), and the "Falha simulada" switch put on or off when
 * asked; then "Salvar fonte", and waits for the form to close, which it does once the
 * server has accepted the edit.
 */
export async function changeSimulatorInItsEditForm(
  page: Page,
  sourceLabel: string,
  change: { pollIntervalAsTyped?: string; speedAsTyped?: string; isFailing?: boolean },
): Promise<void> {
  await findDataSourceRow(page, sourceLabel).getByRole('button', { name: 'Editar' }).click();
  const editForm = page.getByRole('region', { name: `Editar fonte: ${sourceLabel}` });
  if (change.pollIntervalAsTyped !== undefined) {
    await editForm.getByLabel('Intervalo de leitura (segundos)').fill(change.pollIntervalAsTyped);
  }
  if (change.speedAsTyped !== undefined) {
    await editForm.getByLabel('Velocidade (vezes o tempo real)').fill(change.speedAsTyped);
  }
  if (change.isFailing !== undefined) {
    const isFailingSwitch = editForm.getByRole('switch', { name: 'Falha simulada' });
    const isFailingNow = (await isFailingSwitch.getAttribute('aria-checked')) === 'true';
    if (isFailingNow !== change.isFailing) {
      await isFailingSwitch.click();
    }
  }
  await editForm.getByRole('button', { name: 'Salvar fonte' }).click();
  await expect(
    editForm,
    `the edit form of "${sourceLabel}" must close once the server has accepted it`,
  ).toBeHidden();
}

/**
 * Presses "Reiniciar corrida" on a simulator's row (João's ruling 3) and waits until the
 * real server has moved the race start (`config.simulatedStartAtMs`) on. The poll after
 * that answers the green flag, so a test never lands on a race already past its checkered
 * flag, whatever ran before it on the same server. The simulator must be on.
 */
export async function restartTheSimulatedRaceWithItsButton(
  page: Page,
  sourceLabel: string,
): Promise<void> {
  const sourceBefore = await readDataSourceFromTheRealServer(sourceLabel);
  const raceStartBeforeMs = sourceBefore.config.simulatedStartAtMs ?? 0;
  await findDataSourceRow(page, sourceLabel)
    .getByRole('button', { name: 'Reiniciar corrida' })
    .click();
  await expect
    .poll(
      async () => {
        const source = await readDataSourceFromTheRealServer(sourceLabel);
        return source.config.simulatedStartAtMs ?? 0;
      },
      {
        message: `"Reiniciar corrida" must move the race start of "${sourceLabel}" to now`,
        timeout: waitForTheRestartInMilliseconds,
      },
    )
    .toBeGreaterThan(raceStartBeforeMs);
}

/**
 * Starts the seeded simulator as every data source test needs it: read every 0,5 s at
 * speed 60 ("Editar"), turned on with its switch, its race restarted from the green flag
 * ("Reiniciar corrida"), and its 60 cars shown in the positions table.
 */
export async function startTheSeededSimulatorFastFromTheGreenFlag(page: Page): Promise<void> {
  await startTheSeededSimulatorFromTheGreenFlag(page, '60');
}

/**
 * Starts the seeded simulator as above at the speed given, as typed: '1' keeps the race
 * under green for its first 56 simulated minutes, so a test can work through forms
 * without the flag changing under it (gate 2 of PR #18).
 */
export async function startTheSeededSimulatorFromTheGreenFlag(
  page: Page,
  speedAsTyped: string,
): Promise<void> {
  await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
    pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
    speedAsTyped,
  });
  await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
  await restartTheSimulatedRaceWithItsButton(page, seededSimulatorLabel);
  await expect(
    findCarRowsOfPositionsTable(findPositionsTableOfSource(page, seededSimulatorLabel)),
    'the seeded simulator must show a positions table of 60 cars once it is on',
  ).toHaveCount(carsInTheSeededRace, { timeout: waitForTheFirstDataInMilliseconds });
}
