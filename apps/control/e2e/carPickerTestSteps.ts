/**
 * Steps for the item editor's car picker (BAJAOVRLAY-66), as an operator takes them: a
 * graphic's fields about one car ("Carro da frente") are filled by choosing that car once,
 * by its number or, on the battle card, with "Disputa pela Nª posição" for both cars.
 */
import type { Locator, Page } from '@playwright/test';

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
