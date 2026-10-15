// Test support: the steps the quick-fire and macro test files share
// (quickFireWithNumberKey.e2e.ts, macroTakeWaitClear.e2e.ts, emptyServerState.e2e.ts):
// finding the strip and preparing a button in a panel. Functions only; nothing here
// remembers anything between calls or between tests.
import { expect, type Locator, type Page } from '@playwright/test';

/** Finds the quick-fire strip, in the right column above the layer panel. */
export function findQuickFireArea(page: Page): Locator {
  return page.getByRole('region', { name: 'Atalhos e macros' });
}

/**
 * Prepares one race clock button in the panel shown in the strip: "+ Atalho" opens the
 * page's item editor (in the rundown column) with "Onde" on that panel; the label and
 * the session name are typed, everything else is left at the manifest's defaults (the
 * clock's own layer, "Relógio"); then "Salvar item", and the test waits for the editor to
 * close, which it does once the server has accepted the new item.
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
  await itemEditor.getByLabel('Rótulo', { exact: true }).fill(itemLabel);
  await itemEditor.getByLabel('Nome da sessão', { exact: true }).fill(sessionName);
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
