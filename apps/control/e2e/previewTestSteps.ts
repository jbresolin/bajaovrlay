// Test support: the steps the preview test files share (previewThenTake.e2e.ts,
// previewKeyboardLoop.e2e.ts, previewTakeWithTomar.e2e.ts and
// autoPreviewAcrossLayers.e2e.ts): opening the control page, opening an output in a page of
// its own, finding the race clock on an output or in a monitor frame, and preparing an
// item. Functions only; nothing here remembers anything between calls or between tests.
import { type BrowserContext, expect, type Locator, type Page } from '@playwright/test';

import { findItemEditorOwnDropdown, findItemEditorOwnTextField } from './itemEditorOwnFields';

/** Opens the control page and waits until it says it is connected to the server. */
export async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be previewed',
  ).toHaveText('Conectado');
}

/**
 * Opens one output in a page of its own and returns once that page has drawn its layers,
 * which it only does after the server has sent it the state. `/render/` is the program
 * output, as OBS loads it; `/render/?target=preview` is the preview output.
 */
export async function openOutputInItsOwnPage(
  browserContext: BrowserContext,
  rendererPageAddress: '/render/' | '/render/?target=preview',
): Promise<Page> {
  const outputPage = await browserContext.newPage();
  await outputPage.goto(rendererPageAddress);
  await expect(
    outputPage.locator('[data-layer-id="clock"]'),
    `the page at ${rendererPageAddress} must be connected and have drawn its clock layer`,
  ).toBeAttached();
  return outputPage;
}

/** Finds the race clock element on the clock layer of an output's own page. */
export function findRaceClockInOutputPage(outputPage: Page): Locator {
  return outputPage.locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

/**
 * Finds the race clock element on the "Tarja" layer (id `lower-third`) of an output's
 * own page: where an item prepared on that layer is drawn, whatever its graphic.
 */
export function findRaceClockOnLowerThirdLayerOfOutputPage(outputPage: Page): Locator {
  return outputPage.locator('[data-layer-id="lower-third"] > baja-graphic-race-clock');
}

/** Finds the race clock element inside one of the two monitor frames of the control page. */
export function findRaceClockInMonitorFrame(
  page: Page,
  monitorTitle: 'Prévia' | 'Programa',
): Locator {
  return page
    .frameLocator(`iframe[title="${monitorTitle}"]`)
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

/** The race clock, as the "Gráfico" dropdown of the item editor names it (its manifest's name). */
export const raceClockGraphicName = 'Relógio de prova';

/**
 * Chooses the graphic of a new item in the item editor's "Gráfico" dropdown. A new item
 * opens with no graphic chosen ("Escolha um gráfico…"; the order the server lists them
 * in, their package folders, never picks one), and its save buttons stay off until one
 * is chosen, so every step that makes a race clock names the clock here.
 */
export async function chooseGraphicInTheItemEditor(
  page: Page,
  itemEditor: Locator,
  graphicName: string,
): Promise<void> {
  await findItemEditorOwnDropdown(itemEditor, 'Gráfico').click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: graphicName, exact: true }).click();
  await expect(
    findItemEditorOwnDropdown(itemEditor, 'Gráfico'),
    `the editor must show "${graphicName}" as the graphic of the new item`,
  ).toContainText(graphicName);
}

/**
 * Prepares one race clock item through the item editor: "+ Item", the race clock chosen
 * as the graphic, the label, the session name, "Salvar item"; then waits for the editor
 * to close, which it does once the server has accepted the new item. Everything else is
 * left at the manifest's defaults, the layer included (the clock's own layer, "Relógio")
 * unless `layerName` names another one as the "Camada" dropdown lists it.
 */
export async function createRaceClockItemInTheEditor(
  page: Page,
  itemLabel: string,
  sessionName: string,
  layerName?: 'Tarja',
): Promise<void> {
  await page.getByRole('button', { name: '+ Item' }).click();
  // "Edição rápida" draws the same fields with the same labels, so everything is looked
  // up inside the editor.
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, raceClockGraphicName);
  if (layerName !== undefined) {
    await findItemEditorOwnDropdown(itemEditor, 'Camada').click();
    // The list of options is drawn outside the editor, at the end of the page.
    await page.getByRole('option', { name: layerName, exact: true }).click();
  }
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(itemLabel);
  await itemEditor.getByLabel('Título', { exact: true }).fill(sessionName);
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(
    itemEditor,
    `the editor must close once the server has accepted the item "${itemLabel}"`,
  ).toBeHidden();
}

/** Finds the centre area of the page, which holds both monitors and the lines under "Prévia". */
export function findCentreArea(page: Page): Locator {
  return page.getByRole('region', { name: 'Programa e edição rápida' });
}

/**
 * Finds the row of the clock layer in the layer panel. It is looked up inside "Camadas",
 * because the lines under the "Prévia" monitor are named after layers too.
 */
export function findClockLayerRow(page: Page): Locator {
  return page.getByRole('region', { name: 'Camadas' }).getByRole('listitem', { name: 'Relógio' });
}

/**
 * Opens the item editor for a new graphic from "Edição rápida" ("Novo gráfico…"), the way
 * an operator puts up something not prepared in the rundown, chooses the graphic (the
 * race clock unless `graphicName` names another, as the "Gráfico" dropdown lists it),
 * gives it the label, and returns the editor so the test can fill the rest of the form.
 */
export async function openItemEditorWithNewGraphic(
  page: Page,
  itemLabel: string,
  graphicName: string = raceClockGraphicName,
): Promise<Locator> {
  await findCentreArea(page).getByRole('button', { name: 'Novo gráfico…' }).click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, graphicName);
  await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(itemLabel);
  return itemEditor;
}

/**
 * Presses "Salvar e disparar" in the item editor and waits for the editor to close, which
 * it does once the server has accepted both the save and the take.
 */
export async function saveAndTakeTheItemInTheEditor(itemEditor: Locator): Promise<void> {
  await itemEditor.getByRole('button', { name: 'Salvar e disparar' }).click();
  await expect(
    itemEditor,
    'the editor must close once the server has accepted the save and the take',
  ).toBeHidden();
}
