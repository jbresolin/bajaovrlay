/**
 * Preparing a rundown and firing it with Space, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Before a session the operator prepares items (a graphic, a layer and the values to
 *   show) in the rundown; during it, Space puts the next one on air. This test walks
 *   that path in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - Two race clock items made in the item editor appear in the rundown in the order
 *     they were made, and the first one gets the cursor ("Próximo").
 *   - Space puts the item at the cursor on air: the layer panel names it by its label
 *     on the "Relógio" layer, and the cursor moves to the second item.
 *   - Reloading the page changes nothing: the rundown, the cursor and the label on the
 *     layer are all still there, because they live on the server and not in the page.
 *
 * What these tests deliberately do not cover:
 *   - Every field of the item editor, reordering by drag, the Right arrow and the keys'
 *     guards; the component tests in src/features/items/ and src/features/rundown/ do.
 *   - What the clock looks like on air; the renderer's own browser tests check that.
 *   - Auto-out and a server restart; the server's tests cover both.
 *
 * Sharing the server with the other test files:
 *   Every file in this folder runs against the same server, one after the other. This
 *   test therefore empties the rundown and clears the clock layer before it starts (so
 *   leftovers of an earlier run cannot confuse it) and again after it ends, passed or
 *   failed, so the next file finds the server as a new database would be.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * Deletes every item of the rundown, one "Excluir" at a time, waiting after each press
 * until the server has taken the row away.
 */
async function deleteEveryItemOfTheRundown(rundownArea: Locator): Promise<void> {
  const rundownRows = rundownArea.getByRole('listitem');
  let numberOfRowsLeft = await rundownRows.count();
  while (numberOfRowsLeft > 0) {
    await rundownRows.first().getByRole('button', { name: 'Excluir' }).click();
    numberOfRowsLeft = numberOfRowsLeft - 1;
    await expect(
      rundownRows,
      'each "Excluir" must take exactly one row out of the rundown',
    ).toHaveCount(numberOfRowsLeft);
  }
}

/**
 * Opens the control page anew, waits until it is connected, deletes every item of the
 * rundown and clears the clock layer: the server as a new database would have it.
 */
async function openThePageAndEmptyTheRundownAndTheClockLayer(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be prepared or tidied up',
  ).toHaveText('Conectado');
  const rundownArea = page.getByRole('region', { name: 'Rundown' });
  const clockLayerRow = page
    .getByRole('region', { name: 'Camadas' })
    .getByRole('listitem', { name: 'Relógio' });
  await expect(
    rundownArea.getByRole('heading', { name: 'Sessão principal' }),
    'the server must have seeded the rundown "Sessão principal"',
  ).toBeVisible();
  await deleteEveryItemOfTheRundown(rundownArea);
  await clockLayerRow.getByRole('button', { name: 'Limpar' }).click();
  await expect(
    clockLayerRow,
    'the clock layer must be empty once the tidying up is done',
  ).toContainText('vazia');
}

/**
 * Prepares one race clock item through the item editor: "+ Item", the label, the session
 * name the clock will show, "Salvar item"; then waits for the editor to close, which it
 * does once the server has accepted the new item.
 */
async function createRaceClockItemInTheEditor(
  page: Page,
  itemLabel: string,
  sessionName: string,
): Promise<void> {
  await page.getByRole('button', { name: '+ Item' }).click();
  // The editor has a "Nome da sessão" field of its own, and so does the take panel in
  // the centre of the page; everything is looked up inside the editor to tell them apart.
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await expect(
    itemEditor.getByRole('combobox', { name: 'Gráfico' }),
    'a new item must start on the race clock, the one graphic the server has',
  ).toContainText('Relógio de prova');
  await itemEditor.getByLabel('Rótulo').fill(itemLabel);
  await itemEditor.getByLabel('Nome da sessão').fill(sessionName);
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(
    itemEditor,
    `the editor must close once the server has accepted the item "${itemLabel}"`,
  ).toBeHidden();
}

test.describe('preparing a rundown and firing it with Space', () => {
  // Runs after the test whether it passed or failed, so the next test file finds an
  // empty rundown and an empty clock layer even when this one stopped halfway.
  test.afterEach(async ({ page }) => {
    await openThePageAndEmptyTheRundownAndTheClockLayer(page);
  });

  test('creates two clock items, takes the first with Space, names it on its layer, moves the cursor on, and keeps it all across a reload', async ({
    page,
  }) => {
    // Arrange: open the control page, wait until it is connected, start from an empty
    // rundown and an empty clock layer, and prepare two items: the start of the
    // endurance race and its finish.
    await openThePageAndEmptyTheRundownAndTheClockLayer(page);
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await createRaceClockItemInTheEditor(page, 'Chegada do enduro', 'Enduro — Chegada');
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const finishRow = rundownArea.getByRole('listitem', { name: 'Chegada do enduro' });
    await expect(
      rundownArea.getByRole('listitem'),
      'the rundown must list the two items in the order they were made',
    ).toHaveText([/Largada do enduro/, /Chegada do enduro/]);
    await expect(
      startRow,
      'the first item of a new rundown must get the cursor, so Space has something to take',
    ).toHaveAttribute('aria-current', 'true');

    // Act: click on the page title, so the focus is on no button or field (as it is for
    // an operator with the hands on the keyboard), and press Space.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();
    await page.keyboard.press('Space');

    // Assert: the layer panel names the item that went on air, and the cursor moved on.
    await expect(
      clockLayerRow,
      'the layer panel must show the label of the item Space put on air',
    ).toContainText('Largada do enduro');
    await expect(
      clockLayerRow,
      'the layer panel must still name the graphic that is on the layer',
    ).toContainText('Relógio de prova');
    await expect(finishRow, 'after the take the cursor must be on the second item').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      startRow,
      'the item that was just taken must no longer be marked as the next one',
    ).not.toHaveAttribute('aria-current', 'true');

    // Act: reload the page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: nothing was lost, because the server is the truth.
    await expect(
      rundownArea.getByRole('listitem'),
      'after a reload the rundown must still list both items in order',
    ).toHaveText([/Largada do enduro/, /Chegada do enduro/]);
    await expect(
      finishRow,
      'after a reload the cursor must still be on the second item',
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still name the item that is on air',
    ).toContainText('Largada do enduro');
  });
});
