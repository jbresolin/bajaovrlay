// Test support (chaos suite): the pages of a show, opened on a chaos server or on a proxy
// in front of it. The operator's console, at "/", served built by the server itself; and
// the program output at "/render/", as OBS loads it, watched from its first frame: every
// change of what each layer holds (apps/renderer/e2e/whatEachLayerShowed.ts) and every line
// the renderer logs (apps/renderer/e2e/rendererLogLines.ts), so a scenario can prove that
// nothing went blank and nothing played its entrance twice. Functions only.
import { type BrowserContext, expect, type Locator, type Page } from '@playwright/test';

import {
  collectRendererLogLines,
  type RendererLogLine,
} from '../../../../renderer/e2e/rendererLogLines';
import { watchWhatEachLayerShows } from '../../../../renderer/e2e/whatEachLayerShowed';

/** The program output as OBS has it, and every line its renderer has logged so far. */
export type ProgramOutput = { page: Page; logLines: RendererLogLine[] };

// The built page connects in well under a second; a reconnect after a drop waits its
// back-off (up to 5 s) first. Fifteen seconds before a clear failure.
const waitForTheConnectionInMilliseconds = 15_000;

/** Finds the connection badge of the console's header ("Conectado", "Reconectando…"). */
export function findConnectionBadge(page: Page): Locator {
  return page.getByRole('status', { name: 'Conexão com o servidor' });
}

/** Waits until the console's badge reads "Conectado": the server's hello has arrived. */
export async function waitUntilTheConsoleIsConnected(page: Page): Promise<void> {
  await expect(findConnectionBadge(page), 'the console must be connected to the server').toHaveText(
    'Conectado',
    { timeout: waitForTheConnectionInMilliseconds },
  );
}

/** Opens the operator's console at this address in a new page, and waits until connected. */
export async function openTheConsoleAt(context: BrowserContext, address: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${address}/`);
  await waitUntilTheConsoleIsConnected(page);
  return page;
}

/**
 * Opens the program output at this address in a new page, as OBS loads it, watching what
 * each layer holds at every frame and keeping every renderer log line from the start.
 */
export async function openTheProgramOutputAt(
  context: BrowserContext,
  address: string,
): Promise<ProgramOutput> {
  const page = await context.newPage();
  await watchWhatEachLayerShows(page);
  const logLines = collectRendererLogLines(page);
  await page.goto(`${address}/render/`);
  await expect(
    page.locator('[data-layer-id="clock"]'),
    'the output must have drawn its layers',
  ).toBeAttached();
  return { page, logLines };
}

/** Finds the row of one layer ("Torre", "Relógio", "Tarja") in the console's Camadas. */
export function findLayerRowInCamadas(page: Page, layerName: string): Locator {
  return page
    .getByRole('region', { name: 'Camadas' })
    .getByRole('listitem')
    .filter({ has: page.getByText(layerName, { exact: true }) });
}

/** Opens the header's "Menu", picks "Verificar servidor", and answers what it said. */
export async function checkTheServerFromTheMenu(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name: 'Verificar servidor' }).click();
  return page.getByText(/^Servidor no ar, versão/);
}

/**
 * Fires the first button of the shown panel with the key 1, as an operator does: a click
 * on the page's title first leaves the focus on nothing in particular.
 */
export async function fireTheFirstButtonWithKeyOne(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'BajaOvrLay' }).click();
  await page.keyboard.press('1');
}
