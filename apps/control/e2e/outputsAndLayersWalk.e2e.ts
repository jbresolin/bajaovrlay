/**
 * A PiP output and its own graphic, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   The brief's E2E for BAJAOVRLAY-49. João's OBS scene with a picture-in-picture box
 *   carries its own overlay as a second browser source. On "Saídas e camadas" he adds an
 *   output "PiP" with a layer "Moldura", prepares a lower third on that layer and takes
 *   it: the PiP's renderer page shows it, OBS's main source (/render/) does not. A layer
 *   an item still names cannot be deleted; once the item is gone it can. Everything runs
 *   on the real server, with two renderer pages standing in for OBS's two sources.
 *
 * What these tests prove:
 *   - Output "PiP" and layer "Moldura" made on the settings page appear on it, with the
 *     address /render/?output=pip.
 *   - A "Tarja" item on "Moldura" (chosen in the editor's "Camada" under "Saída PiP"),
 *     saved and taken, is drawn by /render/?output=pip and not by /render/, and the PiP's
 *     page reports it: Camadas shows "No ar" on the "Moldura" row.
 *   - After "Limpar" on that row, "Excluir" of "Moldura" is refused with the reason
 *     naming the item; once the item is deleted from the rundown, "Excluir" deletes it.
 *
 * What these tests deliberately do not cover:
 *   - Every guard and command in detail; apps/server/src/modules/outputs.
 *   - The drag of layers in a real browser; OutputLayerEditing.test.tsx drives dnd-kit.
 *   - OBS itself: its two sources are Chromium pages at the two addresses.
 *
 * What it needs: the renderer and the lower third built (`pnpm build`), as every file here.
 */
import { expect, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { findItemEditorOwnDropdown, findItemEditorOwnTextField } from './itemEditorOwnFields';
import {
  chooseGraphicInTheItemEditor,
  openControlPageAndWaitUntilConnected,
} from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** The card of one output on "Saídas e camadas". */
function findCardOfOutput(settingsPage: Page, outputName: string) {
  return settingsPage.getByRole('region', { name: outputName, exact: true });
}

/** Opens "Saídas e camadas" on the page and adds "PiP" with its "Moldura" layer. */
async function addThePipAndItsFrame(settingsPage: Page): Promise<void> {
  await settingsPage.goto('/#/saidas');
  const newOutputForm = settingsPage.getByRole('region', { name: 'Nova saída' });
  await newOutputForm.getByLabel('Nome', { exact: true }).fill('PiP');
  await newOutputForm.getByRole('button', { name: 'Adicionar saída' }).click();
  const pipCard = findCardOfOutput(settingsPage, 'PiP');
  await expect(pipCard, 'the PiP output is listed').toBeVisible();
  await pipCard.getByLabel('Nome da nova camada de PiP').fill('Moldura');
  await pipCard.getByRole('button', { name: 'Adicionar camada' }).click();
  await expect(
    pipCard.getByRole('listitem', { name: 'Moldura' }),
    'the frame is listed on the PiP',
  ).toBeVisible();
}

/** Prepares "Tarja PiP — Baja UFPR" on "Moldura" with "+ Item" and takes it. */
async function prepareAndTakeALowerThirdOnTheFrame(consolePage: Page): Promise<void> {
  await consolePage.getByRole('button', { name: '+ Item' }).click();
  const itemEditor = consolePage.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(consolePage, itemEditor, 'Tarja');
  await findItemEditorOwnDropdown(itemEditor, 'Camada').click();
  // The options are drawn outside the editor; the PiP's are under "Saída PiP".
  await consolePage
    .getByRole('group', { name: 'Saída PiP' })
    .getByRole('option', { name: 'Moldura', exact: true })
    .click();
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill('Tarja PiP — Baja UFPR');
  await itemEditor.getByLabel('Nome', { exact: true }).fill('Baja UFPR');
  await itemEditor.getByRole('button', { name: 'Salvar e disparar' }).click();
  await expect(itemEditor, 'the editor closes once saved and taken').toBeHidden();
}

test.describe('a PiP output with its own graphic', () => {
  test('is drawn by the PiP page only, and its layer is deleted once nothing names it', async ({
    page,
  }) => {
    // Arrange (step 1): "PiP" and "Moldura" on the settings page; OBS's two sources open.
    await addThePipAndItsFrame(page);
    await expect(
      findCardOfOutput(page, 'PiP').getByLabel('Endereço para o OBS'),
      'the address to paste into OBS',
    ).toHaveValue(/\/render\/\?output=pip$/);
    const pipSource = await page.context().newPage();
    await pipSource.goto('/render/?output=pip');
    const mainSource = await page.context().newPage();
    await mainSource.goto('/render/');
    await expect(
      pipSource.locator('[data-layer-id]'),
      'the PiP source draws its one layer',
    ).toHaveCount(1);
    await expect(mainSource.locator('[data-layer-id="lower-third"]')).toBeAttached();

    // Act (step 2): the lower third prepared on "Moldura" and taken from the console.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    await prepareAndTakeALowerThirdOnTheFrame(consolePage);

    // Assert (step 3): on the PiP's source, not on the main one, and reported on air.
    await expect(
      pipSource.locator('[data-layer-id] > baja-graphic-lower-third'),
      'the PiP source draws the lower third',
    ).toHaveCount(1);
    await expect(
      mainSource.locator('baja-graphic-lower-third'),
      'the main source draws no lower third',
    ).toHaveCount(0);
    const frameRow = consolePage
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Moldura' });
    await expect(frameRow, "the PiP's source reported it on air").toContainText('No ar');

    // Act and assert (step 4): cleared; the delete is refused while the item names the
    // layer, and done once the item is deleted.
    await frameRow.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(frameRow, 'the frame is empty again').toContainText('vazia');
    const frameRowOnTheSettings = findCardOfOutput(page, 'PiP').getByRole('listitem', {
      name: 'Moldura',
    });
    await frameRowOnTheSettings.getByRole('button', { name: 'Excluir' }).click();
    await frameRowOnTheSettings.getByRole('button', { name: 'Confirmar: excluir' }).click();
    await expect(
      findCardOfOutput(page, 'PiP').getByRole('alert'),
      'the refusal names the item',
    ).toContainText('Usada por 1 item: "Tarja PiP — Baja UFPR"');
    const itemRow = consolePage
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: 'Tarja PiP — Baja UFPR' });
    await itemRow.getByRole('button', { name: 'Excluir' }).click();
    await itemRow.getByRole('button', { name: 'Confirmar: excluir' }).click();
    await expect(itemRow, 'the item is gone').toBeHidden();
    await frameRowOnTheSettings.getByRole('button', { name: 'Excluir' }).click();
    await frameRowOnTheSettings.getByRole('button', { name: 'Confirmar: excluir' }).click();
    await expect(frameRowOnTheSettings, 'the frame is deleted').toBeHidden();
    await expect(pipSource.locator('[data-layer-id]'), 'and gone from the PiP source').toHaveCount(
      0,
    );
  });
});
