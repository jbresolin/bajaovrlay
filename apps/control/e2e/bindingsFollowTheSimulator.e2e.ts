/**
 * A race clock bound to the simulator follows the race on air, end to end
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   M2's promise (BAJAOVRLAY-20): a graphic shows real data. A race clock item whose
 *   title, flag and whole clock read the simulator's session live ("Fonte", "Relógio da
 *   fonte") goes on air with the simulator's state and keeps following it by itself; a
 *   correction of the session name ("Corrigir valor da fonte…") changes the title on air
 *   at once, and removing it puts the source's name back; when the source fails, the
 *   Camadas row says "fonte atrasada" and nothing on air blanks. This is the brief's walk,
 *   in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove (the brief's five E2E steps):
 *   1. The simulator on; a race clock made with its title and flag bound to the session
 *      and its time set to "Relógio da fonte".
 *   2. Taken: the clock on air shows the simulator's session name, flag and clock.
 *   3. The race restarted at 60×: the flag on air turns yellow by itself at the first
 *      yellow of the seeded race (56,7 simulated minutes in, about a minute of waiting).
 *   4. A correction of the session name changes the title on air; removed, the title
 *      goes back to the simulator's.
 *   5. "Falha simulada" on: the Camadas row shows "fonte atrasada" and the clock stays on
 *      air with its data.
 *
 * What these tests deliberately do not cover:
 *   - What OBS draws: the data on air is read from the server's state
 *     (GET /api/v1/state), what the renderer draws from; takeAndClear.e2e.ts covers the
 *     renderer.
 *   - A red flag: the seeded race has none; liveRefreshRaceClock.test.ts proves the stop.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied (nothing on air, no item, no correction, the
 *   simulator off with its default settings), so this test passes whatever ran before it.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { readDataOnAirOfLayerFromTheRealServer } from './dataSourceStateOnTheRealServer';
import {
  changeSimulatorInItsEditForm,
  openDataSourcesPageAndWaitUntilConnected,
  restartTheSimulatedRaceWithItsButton,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import { openItemEditorWithNewGraphic, saveAndTakeTheItemInTheEditor } from './previewTestSteps';

// The simulator names its session so that simulated data on air says it is simulated.
const simulatedSessionName = 'Enduro de Resistência (simulado)';
const correctedSessionName = 'Enduro — Etapa Nacional';
// At 60× the seeded race's first yellow comes 56,7 simulated minutes in: about 57 s.
const waitForTheFirstYellowInMilliseconds = 90_000;
// A refresh follows the next poll (every 0,5 s); a few seconds cover a slow machine.
const waitForTheNextRefreshInMilliseconds = 10_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Opens the console and waits until it says it is connected to the server. */
async function openConsoleAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the console must connect to the server before anything can be taken',
  ).toHaveText('Conectado');
}

/** Picks an option in one of the item editor's dropdowns, by the dropdown's name. */
async function chooseInEditorDropdown(
  page: Page,
  itemEditor: Locator,
  dropdownName: string,
  optionName: string,
): Promise<void> {
  await itemEditor.getByRole('combobox', { name: dropdownName, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/** Sets one field of the item editor to "Fonte": the simulator, at the path given. */
async function bindFieldToTheSimulator(
  page: Page,
  itemEditor: Locator,
  fieldTitle: string,
  pathLabel: string,
): Promise<void> {
  await chooseInEditorDropdown(page, itemEditor, `Como preencher ${fieldTitle}`, 'Fonte');
  await chooseInEditorDropdown(page, itemEditor, `Fonte de ${fieldTitle}`, seededSimulatorLabel);
  await chooseInEditorDropdown(page, itemEditor, `O que ${fieldTitle} lê da fonte`, pathLabel);
}

/** Polls the data the real server has on air on the clock layer. */
function pollTheClockOnAir() {
  return readDataOnAirOfLayerFromTheRealServer('clock');
}

/** The Camadas row of the clock layer. */
function findClockLayerRow(page: Page): Locator {
  return page.getByRole('region', { name: 'Camadas' }).getByRole('listitem', { name: 'Relógio' });
}

/** Opens "Corrigir valor da fonte…" of the title in "Edição rápida", the clock loaded. */
async function openTheTitleCorrection(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Corrigir valor da fonte: Título' }).click();
  return page.getByRole('dialog');
}

test.describe('a race clock bound to the simulator', () => {
  test('follows the race on air, takes a correction and keeps its data when the source fails', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Arrange (step 1): the simulator on at 60×, read every 0,5 s; on the console, a race
    // clock whose title and flag read the session and whose time is "Relógio da fonte".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    await openConsoleAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(page, 'Relógio do enduro — fonte');
    await bindFieldToTheSimulator(page, itemEditor, 'Título', 'Sessão › Nome da sessão');
    await bindFieldToTheSimulator(page, itemEditor, 'Bandeira', 'Sessão › Bandeira');
    await chooseInEditorDropdown(
      page,
      itemEditor,
      'Como preencher Tempo de referência',
      'Relógio da fonte',
    );
    await chooseInEditorDropdown(
      page,
      itemEditor,
      'Fonte de Tempo de referência',
      seededSimulatorLabel,
    );

    // Act (step 2): save and take it.
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): on air with the simulator's session: its name, the green flag, its
    // countdown running.
    await expect
      .poll(pollTheClockOnAir, {
        message: 'the clock on air must show the simulator session',
        timeout: waitForTheNextRefreshInMilliseconds,
      })
      .toMatchObject({
        sessionName: simulatedSessionName,
        state: 'green',
        clockMode: 'remaining',
        running: true,
      });

    // Act (step 3): restart the race at 60× and wait.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await restartTheSimulatedRaceWithItsButton(page, seededSimulatorLabel);

    // Assert (step 3): the flag on air turns yellow by itself at the first yellow.
    await expect
      .poll(async () => (await pollTheClockOnAir())?.state, {
        message: 'the flag on air must turn yellow at the simulator first yellow',
        timeout: waitForTheFirstYellowInMilliseconds,
        intervals: [500],
      })
      .toBe('yellow');

    // Act (step 4a): correct the session name from "Edição rápida".
    await openConsoleAndWaitUntilConnected(page);
    await findClockLayerRow(page).getByRole('button', { name: 'Editar', exact: true }).click();
    const correctionDialog = await openTheTitleCorrection(page);
    await correctionDialog.getByLabel('Valor corrigido').fill(correctedSessionName);
    await correctionDialog.getByLabel('Motivo (obrigatório)').fill('Nome oficial da prova.');
    await correctionDialog.getByRole('button', { name: 'Salvar correção' }).click();

    // Assert (step 4a): the title on air is the correction, and Camadas says so.
    await expect
      .poll(async () => (await pollTheClockOnAir())?.sessionName, {
        message: 'the correction must reach the title on air',
        timeout: waitForTheNextRefreshInMilliseconds,
      })
      .toBe(correctedSessionName);
    await expect(
      findClockLayerRow(page).getByText('valor corrigido'),
      'the Camadas row must say a value is corrected',
    ).toBeVisible();

    // Act (step 4b): remove the correction.
    const removalDialog = await openTheTitleCorrection(page);
    await removalDialog.getByRole('button', { name: 'Remover correção' }).click();

    // Assert (step 4b): the simulator's name is back on air.
    await expect
      .poll(async () => (await pollTheClockOnAir())?.sessionName, {
        message: "the simulator's own name must come back",
        timeout: waitForTheNextRefreshInMilliseconds,
      })
      .toBe(simulatedSessionName);

    // Act (step 5): "Falha simulada" on.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, { isFailing: true });
    await openConsoleAndWaitUntilConnected(page);

    // Assert (step 5): the row says "fonte atrasada", and the clock is still on air with
    // the simulator's data (nothing blanks).
    await expect(
      findClockLayerRow(page).getByText('fonte atrasada'),
      'the Camadas row must say the source is late',
    ).toBeVisible({ timeout: waitForTheNextRefreshInMilliseconds });
    expect(
      await pollTheClockOnAir(),
      'the clock must stay on air with the source data',
    ).toMatchObject({ sessionName: simulatedSessionName, clockMode: 'remaining' });
  });
});
