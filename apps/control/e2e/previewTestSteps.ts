// Test support: the steps the two preview test files share (previewThenTake.e2e.ts and
// previewKeyboardLoop.e2e.ts): opening the control page, opening an output in a page of
// its own, finding the race clock on an output or in a monitor frame, and preparing an
// item. Functions only; nothing here remembers anything between calls or between tests.
import { type BrowserContext, expect, type Locator, type Page } from '@playwright/test';

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

/** Finds the race clock element inside one of the two monitor frames of the control page. */
export function findRaceClockInMonitorFrame(
  page: Page,
  monitorTitle: 'Prévia' | 'Programa',
): Locator {
  return page
    .frameLocator(`iframe[title="${monitorTitle}"]`)
    .locator('[data-layer-id="clock"] > baja-graphic-race-clock');
}

/**
 * Prepares one race clock item through the item editor: "+ Item", the label, the session
 * name, "Salvar item"; then waits for the editor to close, which it does once the server
 * has accepted the new item. Everything else is left at the manifest's defaults.
 */
export async function createRaceClockItemInTheEditor(
  page: Page,
  itemLabel: string,
  sessionName: string,
): Promise<void> {
  await page.getByRole('button', { name: '+ Item' }).click();
  // "Edição rápida" draws the same fields with the same labels, so everything is looked
  // up inside the editor.
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await itemEditor.getByLabel('Rótulo', { exact: true }).fill(itemLabel);
  await itemEditor.getByLabel('Nome da sessão', { exact: true }).fill(sessionName);
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
