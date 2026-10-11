/**
 * Changing an item that is on air, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   During a session the flag changes while the clock item is on air. The operator opens
 *   that item in the item editor, changes the flag and presses "Atualizar no ar": the item
 *   is saved AND the graphic on air changes in place, without leaving the screen. The
 *   editor's fields are generated from the graphic's manifest; nothing in the control
 *   page is written for the race clock. This test walks that path in a real Chromium
 *   against the real server, the real renderer page and a real SQLite file.
 *
 *   As in takeAndClear.e2e.ts, a second browser page at `/render/` stands in for OBS: it
 *   is the program output, the truth about what the viewers see.
 *
 * What these tests prove:
 *   - An item made in the generated editor (label, session name, green flag) appears in
 *     the rundown, and "Disparar" puts it on air: the layer says "No ar" within 3 seconds
 *     and the program output shows the session name and the green flag.
 *   - Opening that item while it is on air offers "Atualizar no ar". With only the flag
 *     changed to yellow, a press closes the editor, and the clock in the program output
 *     shows the yellow flag and is the very same element as before: it was changed in
 *     place, not taken off and put back (no blink).
 *   - The session name on air was left alone, because only the changed field was sent.
 *   - The item itself was saved too: opened again, its form shows the yellow flag.
 *
 * What these tests deliberately do not cover:
 *   - Which commands the press sends and in which order, a refused save or a refused
 *     on-air update; ItemEditorPanelUpdateOnAir.test.tsx and its "Problems" file do.
 *   - "Atualizar" of "Edição rápida"; takeAndClear.e2e.ts covers that.
 *   - Clearing a field on air with "limpar", and a graphic other than the race clock
 *     (the server of this run registers only the built race clock); the component tests
 *     use a second fixture manifest for both.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium, not OBS's browser.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and the program output is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no item in the rundown), so this test passes whatever
 *   ran before it, in any order, and leaves its own item and clock behind without harm.
 */
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';

/** Opens the control page and waits until it says it is connected to the server. */
async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be prepared',
  ).toHaveText('Conectado');
}

/**
 * Opens the program output as OBS does: a page of its own at `/render/`, with nothing
 * after it. Returns once that page has drawn its layers, which it only does after the
 * server has sent it the state, so by then it is connected and ready to report.
 */
async function openProgramOutputAsObsDoes(browserContext: BrowserContext): Promise<Page> {
  const programOutputPage = await browserContext.newPage();
  await programOutputPage.goto('/render/');
  await expect(
    programOutputPage.locator('[data-layer-id="clock"]'),
    'the OBS stand-in must be connected and have drawn its clock layer',
  ).toBeAttached();
  return programOutputPage;
}

/** Finds the race clock element on the clock layer of the program output (the OBS stand-in). */
function findRaceClockInProgramOutput(programOutputPage: Page): Locator {
  return programOutputPage.locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

/**
 * Finds the item editor. Its fields are looked up inside it, because "Edição rápida" in
 * the centre of the page draws the same graphic's fields with the same labels.
 */
function findItemEditor(page: Page): Locator {
  return page.getByRole('region', { name: 'Editor de item' });
}

/** Chooses a flag in the item editor's "Bandeira" dropdown, by the name the manifest gives it. */
async function chooseFlagInItemEditor(page: Page, flagName: string): Promise<void> {
  await findItemEditor(page).getByRole('combobox', { name: 'Bandeira', exact: true }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: flagName, exact: true }).click();
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('changing an item on air from the item editor', () => {
  test('creates a clock item in the generated editor, takes it, and "Atualizar no ar" changes its flag in place on the program output and saves the item', async ({
    page,
    context,
  }) => {
    // Arrange: OBS is showing the program output (a second page at /render/ stands in
    // for it) and the control page is open and connected, on an emptied server.
    const programOutputPage = await openProgramOutputAsObsDoes(context);
    await openControlPageAndWaitUntilConnected(page);
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    const itemEditor = findItemEditor(page);

    // Act: prepare the start of the endurance race as an item, under the green flag.
    await page.getByRole('button', { name: '+ Item' }).click();
    await expect(
      itemEditor.getByRole('combobox', { name: 'Gráfico', exact: true }),
      'a new item must start on the race clock, the one graphic the server has',
    ).toContainText('Relógio de prova');
    await itemEditor.getByLabel('Rótulo', { exact: true }).fill('Largada do enduro');
    await itemEditor.getByLabel('Nome da sessão', { exact: true }).fill('Enduro — Largada');
    await chooseFlagInItemEditor(page, 'Verde');
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();

    // Assert: the editor closed, which it does once the server accepted the item, and
    // the item is in the rundown. It is not on air yet.
    await expect(
      itemEditor,
      'the editor must close once the server has accepted the item',
    ).toBeHidden();
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    await expect(startRow, 'the new item must be listed in the rundown').toBeVisible();
    await expect(clockLayerRow, 'saving an item must put nothing on air').toContainText('vazia');

    // Act: fire the item with its row's "Disparar" button.
    await startRow.getByRole('button', { name: 'Disparar' }).click();

    // Assert: the layer says "No ar" within 3 seconds (the program output played the clock
    // in and reported it), and the program output shows what the item holds.
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of the take, once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    await expect(
      clockLayerRow,
      'the layer panel must name the item that is on air by its label',
    ).toContainText('Largada do enduro');
    const raceClockInProgramOutput = findRaceClockInProgramOutput(programOutputPage);
    await expect(
      raceClockInProgramOutput.getByTestId('race-clock-session-name'),
      'the program output must show the session name typed in the generated editor',
    ).toHaveText('Enduro — Largada');
    await expect(
      raceClockInProgramOutput.getByTestId('race-clock-flag-label'),
      'the program output must show the green flag the item was saved with',
    ).toHaveText('VERDE');

    // Arrange (for the update): remember which element the clock in the program output
    // is. A handle points at that one element; it is not found again later.
    const raceClockElementBeforeTheUpdate = await raceClockInProgramOutput.elementHandle();

    // Act: a yellow flag comes out. Open the item, change only the flag, and press
    // "Atualizar no ar".
    await startRow.getByRole('button', { name: 'Editar' }).click();
    await expect(
      itemEditor.getByRole('button', { name: 'Atualizar no ar' }),
      'the editor of an item that is on air must offer "Atualizar no ar"',
    ).toBeVisible();
    await expect(
      itemEditor.getByRole('combobox', { name: 'Bandeira', exact: true }),
      'the editor must open showing the flag the item stores',
    ).toHaveText('Verde');
    await chooseFlagInItemEditor(page, 'Amarela');
    await itemEditor.getByRole('button', { name: 'Atualizar no ar' }).click();

    // Assert: the editor closed, so the save and the on-air update were both accepted.
    await expect(
      itemEditor,
      'the editor must close once the save and the on-air update were both accepted',
    ).toBeHidden();
    // The clock in the program output shows the yellow flag, and it is the same element
    // as before the update. Had the item been taken again (off and back on, the blink
    // this button exists to avoid), a new element would be in its place.
    await expect(
      raceClockInProgramOutput.getByTestId('race-clock-flag-label'),
      'after "Atualizar no ar" the clock in the program output must show the yellow flag',
    ).toHaveText('AMARELA');
    const isTheSameElementAsBeforeTheUpdate = await raceClockInProgramOutput.evaluate(
      (raceClockElementNow, raceClockElementBefore) =>
        raceClockElementNow === raceClockElementBefore,
      raceClockElementBeforeTheUpdate,
    );
    expect(
      isTheSameElementAsBeforeTheUpdate,
      'the clock on air must be changed in place: the same element as before, not a new one',
    ).toBe(true);
    await expect(
      raceClockInProgramOutput.getByTestId('race-clock-session-name'),
      'a field that was not changed must stay on air as it was',
    ).toHaveText('Enduro — Largada');
    await expect(
      clockLayerRow,
      'an update must leave the clock "No ar"; it never goes back to "Carregando"',
    ).toContainText('No ar');

    // Act: open the item once more.
    await startRow.getByRole('button', { name: 'Editar' }).click();

    // Assert: the item itself holds the yellow flag, so the next take of it shows what is
    // on air now and not the green flag it was first saved with.
    await expect(
      itemEditor.getByRole('combobox', { name: 'Bandeira', exact: true }),
      '"Atualizar no ar" must also save the item: its form must show the yellow flag',
    ).toHaveText('Amarela');

    // Tidy up: close OBS's stand-in. The item and the clock are left behind on purpose:
    // the next test, whichever it is, empties the server before it starts.
    await programOutputPage.close();
  });
});
