/**
 * Everything on air comes from an item, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 nothing reaches the screen except through an item. A graphic made
 *   on the spot is a new item: "Novo gráfico…" in "Edição rápida" opens the item editor,
 *   and "Salvar e disparar" saves it and puts it on air. "Edição rápida" then only changes
 *   what is up; a change it makes is a one-off, marked "alterado no ar" on the Camadas row,
 *   until the operator keeps it with "Salvar no item". These tests walk both in a real
 *   Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - "Novo gráfico…", the form filled, "Salvar e disparar": the clock is on air, and its
 *     Camadas row names the new item by its label.
 *   - "Editar" on that row, a new title, "Atualizar": the row shows "alterado no ar";
 *     "Salvar no item" takes the chip away; after "Limpar" and a new take of the item
 *     (its shortcut button), the program monitor shows the new title.
 *
 * What these tests deliberately do not cover:
 *   - The clock question of "Salvar no item" and "Salvar como item"; the Camadas component
 *     tests cover both answers (LayerStatusPanelOnAirChanges.test.tsx).
 *   - OBS: no program output page is opened; the program monitor is enough to see what is
 *     on air.
 *
 * Sharing the server with the other tests: the server is emptied before each test.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  findClockLayerRow,
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';
import { findQuickFireArea } from './quickFireTestSteps';

/** The label of the item the tests make on the spot. */
const safetyCarClockLabel = 'Relógio — safety car';

/** Makes the safety car clock with "Novo gráfico…" and puts it on air with "Salvar e disparar". */
async function makeAndTakeTheSafetyCarClock(page: Page): Promise<void> {
  const itemEditor = await openItemEditorWithNewGraphic(page, safetyCarClockLabel);
  await itemEditor.getByLabel('Título', { exact: true }).fill('Enduro — Safety car');
  await saveAndTakeTheItemInTheEditor(itemEditor);
}

/** Finds the session name the race clock in the "Programa" monitor shows. */
function findSessionNameInProgramMonitor(page: Page): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock')
    .getByTestId('race-clock-session-name');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a graphic made on the spot', () => {
  test('goes on air with "Salvar e disparar", and Camadas names its item', async ({ page }) => {
    // Arrange: the control page, nothing on air.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = findClockLayerRow(page);
    await expect(clockLayerRow, 'the clock layer must start empty').toContainText('vazia');

    // Act: "Novo gráfico…", the title typed, "Salvar e disparar".
    await makeAndTakeTheSafetyCarClock(page);

    // Assert: the clock is on its layer and the row names the item it came from.
    await expect(
      clockLayerRow,
      'the clock layer must show the race clock just taken',
    ).toContainText('Relógio de prova');
    await expect(clockLayerRow, 'every Camadas row must name the item it came from').toContainText(
      safetyCarClockLabel,
    );
    await expect(
      findSessionNameInProgramMonitor(page),
      'the program monitor must show the title typed in the editor',
    ).toHaveText('Enduro — Safety car');
  });
});

test.describe('a change on air kept in the item', () => {
  test('marks the row "alterado no ar", and "Salvar no item" makes the next take show it', async ({
    page,
  }) => {
    // Arrange: the safety car clock on air, loaded into "Edição rápida", its title changed
    // and sent with "Atualizar".
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = findClockLayerRow(page);
    await makeAndTakeTheSafetyCarClock(page);
    await clockLayerRow.getByRole('button', { name: 'Editar', exact: true }).click();
    const quickEditArea = page.getByRole('region', { name: 'Edição rápida' });
    await quickEditArea.getByLabel('Título', { exact: true }).fill('Enduro — Relargada');
    await quickEditArea.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await expect(clockLayerRow, 'a change on air must be marked on the Camadas row').toContainText(
      'alterado no ar',
    );

    // Act: "Salvar no item"; then clear the layer and fire the item's shortcut button.
    await clockLayerRow.getByRole('button', { name: 'Salvar no item' }).click();
    await expect(
      clockLayerRow,
      'once saved into the item, the air no longer differs from it',
    ).not.toContainText('alterado no ar');
    await clockLayerRow.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(clockLayerRow, 'the clock layer must be empty after "Limpar"').toContainText(
      'vazia',
    );
    await findQuickFireArea(page)
      .getByRole('listitem', { name: safetyCarClockLabel })
      .getByRole('button', { name: `${safetyCarClockLabel} Relógio de prova` })
      .click();

    // Assert: the new take of the item shows the title saved into it, with no chip.
    await expect(
      findSessionNameInProgramMonitor(page),
      'the item must now give the title that was changed on air',
    ).toHaveText('Enduro — Relargada');
    await expect(
      clockLayerRow,
      'a new take of the item starts with nothing changed on air',
    ).not.toContainText('alterado no ar');
  });
});
