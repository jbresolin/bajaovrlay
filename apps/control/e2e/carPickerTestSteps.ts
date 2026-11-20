/**
 * Steps for the item editor's car picker (BAJAOVRLAY-66), as an operator takes them: a
 * graphic's fields about one car ("Carro da frente") are filled by choosing that car once,
 * by its number or, on the battle card, with "Disputa pela Nª posição" for both cars. And
 * "Escolher carros" (BAJAOVRLAY-82): the same cars picked from a quick-fire button's
 * chevron, without the editor.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { seededSimulatorLabel } from './dataSourcesTestSteps';

/** Picks an option in one of the item editor's dropdowns, by the dropdown's name. */
async function chooseInEditorDropdown(
  page: Page,
  itemEditor: Locator,
  dropdownName: string,
  optionName: string,
): Promise<void> {
  await itemEditor.getByRole('combobox', { name: dropdownName, exact: true }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Picks one car of a graphic by its number on the seeded simulator, live: "Pelo número do
 * carro", the simulator, the number. Every field of that car then reads it.
 */
export async function pickCarByNumberInTheEditor(
  page: Page,
  itemEditor: Locator,
  pick: { carLabel: string; carNumber: number },
): Promise<void> {
  await chooseInEditorDropdown(
    page,
    itemEditor,
    `Como escolher ${pick.carLabel}`,
    'Pelo número do carro',
  );
  await chooseInEditorDropdown(page, itemEditor, `Fonte de ${pick.carLabel}`, seededSimulatorLabel);
  await itemEditor
    .getByLabel(`Número do carro — ${pick.carLabel}`, { exact: true })
    .fill(String(pick.carNumber));
}

/**
 * Chooses "Disputa pela Nª posição" on the battle card: the car ahead at that place and
 * the car behind at the next, both by place, on the only source there is.
 */
export async function chooseBattleForPlaceInTheEditor(
  page: Page,
  itemEditor: Locator,
  placeNumber: number,
): Promise<void> {
  await chooseInEditorDropdown(
    page,
    itemEditor,
    'Disputa pela posição',
    `Disputa pela ${placeNumber}ª posição`,
  );
}

/**
 * Opens "Escolher carros" with the small chevron of a quick-fire button and returns its
 * box, once it is on screen.
 */
export async function openQuickCarPickOfButton(page: Page, itemLabel: string): Promise<Locator> {
  await page.getByRole('button', { name: `Escolher carros: ${itemLabel}`, exact: true }).click();
  const box = page.getByRole('dialog', { name: `Escolher carros — ${itemLabel}` });
  await expect(box, 'the chevron must open the box of "Escolher carros"').toBeVisible();
  return box;
}

/**
 * Opens "Escolher carros" from a quick-fire button's "⋯" menu, the other way in, and
 * returns its box once it is on screen.
 */
export async function openQuickCarPickFromMenuOfButton(
  page: Page,
  itemLabel: string,
): Promise<Locator> {
  await page.getByRole('button', { name: `Mais ações: ${itemLabel}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Escolher carros', exact: true }).click();
  const box = page.getByRole('dialog', { name: `Escolher carros — ${itemLabel}` });
  await expect(box, 'the menu entry must open the box of "Escolher carros"').toBeVisible();
  return box;
}

/**
 * Types the battle card's two cars by number in the box, as an operator does: "Por número"
 * (a card stored as a battle for a place opens on "Pela posição"), the car ahead, Enter,
 * the car behind.
 */
export async function typeBothCarsInQuickCarPick(
  box: Locator,
  cars: { carAheadNumber: number; carBehindNumber: number },
): Promise<void> {
  await box.getByRole('tab', { name: 'Por número' }).click();
  const carAheadBox = box.getByLabel('Carro da frente', { exact: true });
  await carAheadBox.fill(String(cars.carAheadNumber));
  await carAheadBox.press('Enter');
  await box.getByLabel('Carro de trás', { exact: true }).fill(String(cars.carBehindNumber));
}
