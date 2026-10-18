// Test support: the steps the data source test files share (simulatorRaceMoves.e2e.ts,
// simulatorFailureKeepsTheData.e2e.ts, recordAndReplay.e2e.ts, emptyServerState.e2e.ts):
// opening the "Fontes de dados" page, finding a source's row and its data, reading the
// positions table, and changing a simulator through its "Editar" form, as an operator
// does. Functions only; nothing here remembers anything between calls or between tests.
import { expect, type Locator, type Page } from '@playwright/test';

import { realServerPort, seededSimulatorLabel } from './emptyTheServerState';

/**
 * The source every new database has (seeded by the server, off). Declared once, beside
 * the reset that puts it back, and passed on here for the test files.
 */
export { seededSimulatorLabel };

/** The kinds of source "+ Fonte" offers, as its buttons name them. */
export type NewSourceKindButton = 'Simulador' | 'Reprodução';

/** How many cars the seeded simulator races with its default settings. */
export const carsInTheSeededRace = 60;

/** Opens the "Fontes de dados" page and waits until it says it is connected to the server. */
export async function openDataSourcesPageAndWaitUntilConnected(page: Page): Promise<void> {
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
 * Changes a simulator through its "Editar" form: the speed typed as the operator types
 * it ("60"), and the "Falha simulada" switch put on or off when asked; then "Salvar fonte",
 * and waits for the form to close, which it does once the server has accepted the edit.
 */
export async function changeSimulatorInItsEditForm(
  page: Page,
  sourceLabel: string,
  change: { speedAsTyped?: string; isFailing?: boolean },
): Promise<void> {
  await findDataSourceRow(page, sourceLabel).getByRole('button', { name: 'Editar' }).click();
  const editForm = page.getByRole('region', { name: `Editar fonte: ${sourceLabel}` });
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
 * Asks the real server how many graphics it has on its outputs (program and preview),
 * as GET /api/v1/state answers it: the data source pages must never change that.
 */
export async function countGraphicsOnTheOutputsOfTheRealServer(): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${realServerPort}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${response.status} on the real server`);
  }
  const state = (await response.json()) as { instances: unknown[] };
  return state.instances.length;
}
