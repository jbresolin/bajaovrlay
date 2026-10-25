// Test support: the steps the quick-fire and macro test files share
// (quickFireWithNumberKey.e2e.ts, macroTakeWaitClear.e2e.ts, macroStopDuringWait.e2e.ts,
// emptyServerState.e2e.ts): finding the strip, preparing a button in a panel and writing
// a take-wait-clear macro. Functions only; nothing here remembers anything between calls
// or between tests.
import { expect, type Locator, type Page } from '@playwright/test';

import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import { chooseGraphicInTheItemEditor, raceClockGraphicName } from './previewTestSteps';

/** Finds the quick-fire strip, in the right column above the layer panel. */
export function findQuickFireArea(page: Page): Locator {
  return page.getByRole('region', { name: 'Atalhos e macros' });
}

/**
 * Prepares one race clock button in the panel shown in the strip: "+ Atalho" opens the
 * page's item editor (in the rundown column) with "Onde" on that panel; the race clock is
 * chosen as the graphic, the label and the session name are typed, everything else is
 * left at the manifest's defaults (the clock's own layer, "Relógio"); then "Salvar item",
 * and the test waits for the editor to close, which it does once the server has accepted
 * the new item.
 */
export async function createRaceClockButtonInPanelShown(
  page: Page,
  itemLabel: string,
  sessionName: string,
): Promise<void> {
  await findQuickFireArea(page).getByRole('button', { name: '+ Atalho' }).click();
  // "Edição rápida" draws the same fields with the same labels, so everything is looked
  // up inside the editor.
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, raceClockGraphicName);
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(itemLabel);
  await itemEditor.getByLabel('Título', { exact: true }).fill(sessionName);
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(
    itemEditor,
    `the editor must close once the server has accepted the button "${itemLabel}"`,
  ).toBeHidden();
  await expect(
    findQuickFireArea(page).getByRole('listitem', { name: itemLabel }),
    `the button "${itemLabel}" must appear in the panel`,
  ).toBeVisible();
}

/** Opens a dropdown of the macro editor by its name and picks one option. */
async function chooseInMacroEditor(page: Page, dropdownName: string, optionName: string) {
  const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
  await macroEditor.getByRole('combobox', { name: dropdownName }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Writes and saves, in the macro editor of the Macros tab, a macro of three steps: take
 * the "Atalhos" button `itemLabel`, wait `waitInSecondsAsTyped` ("0,5", "5"), clear the
 * clock layer. Waits for the editor to close, which it does once the server has the macro.
 */
export async function createTakeWaitAndClearClockMacro(
  page: Page,
  macro: { macroLabel: string; itemLabel: string; waitInSecondsAsTyped: string },
): Promise<void> {
  const quickFireArea = findQuickFireArea(page);
  await quickFireArea.getByRole('tab', { name: 'Macros' }).click();
  await quickFireArea.getByRole('button', { name: '+ Macro' }).click();
  const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
  await macroEditor.getByLabel('Rótulo da macro').fill(macro.macroLabel);
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Item do passo 1', `${macro.itemLabel} (Atalhos)`);
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Tipo do passo 2', 'Esperar');
  await macroEditor.getByLabel('Espera do passo 2 (segundos)').fill(macro.waitInSecondsAsTyped);
  await macroEditor.getByRole('button', { name: '+ Passo' }).click();
  await chooseInMacroEditor(page, 'Tipo do passo 3', 'Limpar camada');
  await chooseInMacroEditor(page, 'Camada do passo 3', 'Relógio');
  await macroEditor.getByRole('button', { name: 'Salvar macro' }).click();
  await expect(macroEditor, 'the editor must close once the server has the macro').toBeHidden();
}
