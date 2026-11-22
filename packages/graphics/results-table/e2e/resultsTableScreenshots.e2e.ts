/**
 * Results table screenshots on the design's grey and black stages
 * (packages/graphics/results-table, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the results table in
 *   Ardósia (the standings board's look, BAJAOVRLAY-83) is pinned by screenshots of
 *   preview.html?data=…&stage=… at 1920×1080, compared against the baselines stored next to
 *   this file.
 *
 * What these tests prove, on the grey (#7f7f7f) and the black (#0a0a0a) stage each:
 *   - The overall page during spoilers: "GERAL" and the event in the head, "16 EQUIPES",
 *     "–" in every rank, "SPOILERS" under Projeto and Total, the rows in car order.
 *   - The qualifying page: ranks 1 to 3 on the green chip, "51.9" for the two laps
 *     "51.9 / 52.3", "91.8%", "SIM"/"NÃO", "1º" and "-".
 *   - The qualifying page ordered by "Melhor volta", descending: Pato's 66.4 first, the
 *     ranks still the site's.
 *   - Page 2 of 26BR's Enduro: "2/2 · 21º A 38º", 18 rows.
 *   - In every shot the board spans the wide boards' title-safe width, x 96..1824, from y 54.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of the play-in (or of the turn). The page hold and a
 *     long text's hold are made very long, so no turn or scroll lands in a shot.
 *   - Other operating systems: baselines are rendered on Linux. After a deliberate visual
 *     change, refresh them with `pnpm --filter @bajaovrlay/results-table test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

import {
  createEnduroPage,
  createOverallPageDuringSpoilers,
  createQualifyingPage,
} from '../src/previewData.js';

/** Waits until the last preview action has answered with the board on air. */
async function waitUntilOnAir(page: Page): Promise<void> {
  await expect(page.locator('body'), 'the results table must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/** Opens the preview on air with the data on the stage, nothing moving by itself. */
async function openPreviewOnAir(
  page: Page,
  data: Record<string, unknown>,
  stage: string,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, {
    '--motion-board-hold': '600000ms',
    ...textTokensHoldingAtTheStart,
  });
  await page.goto(`${buildPreviewAddressWithData(data)}&stage=${stage}`);
  await waitUntilOnAir(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Turns the page with the preview's button and waits for the turn to end. */
async function turnToTheNextPage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Próxima página' }).click();
  await waitUntilOnAir(page);
}

/** Hides the preview's buttons, which are not on air. */
async function hidePreviewControls(page: Page): Promise<void> {
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.display = 'none';
  });
}

const boardScenarios = [
  // João's first screenshot: the overall page with spoilers on.
  { name: 'spoilers', data: createOverallPageDuringSpoilers(), turnsBeforeTheShot: 0 },
  // João's second screenshot: a prova page, ranked, text cells.
  { name: 'qualifying', data: createQualifyingPage(), turnsBeforeTheShot: 0 },
  // The same page ordered by a column the item names, the ranks left as the site's.
  {
    name: 'qualifying by best lap descending',
    data: { ...createQualifyingPage(), sortByColumn: 'Melhor volta', sortDirection: 'descending' },
    turnsBeforeTheShot: 0,
  },
  // A page of 38 rows, on its second page.
  { name: 'enduro page 2', data: createEnduroPage(), turnsBeforeTheShot: 1 },
];

const stages = ['grey', 'black'];

test.describe('the results table looks like its baselines', () => {
  for (const { name, data, turnsBeforeTheShot } of boardScenarios) {
    for (const stage of stages) {
      test(`${name} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the preview on air with this page, turned to the shot's page, its
        // buttons hidden.
        await openPreviewOnAir(page, data, stage);
        for (let turn = 0; turn < turnsBeforeTheShot; turn += 1) {
          await turnToTheNextPage(page);
        }
        await hidePreviewControls(page);
        const dumpName = `results-table-${name.replaceAll(' ', '-')}-${stage}.png`;
        const dumpShot = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
        process.stdout.write(`PNGDUMP ${dumpName} ${dumpShot.toString('base64')}\n`);

        // Act: measure the board on the stage.
        const boardBox = await page.getByTestId('results-table').boundingBox();

        // Assert: the board spans the title-safe width from y 54, and the whole stage
        // matches its baseline (1% of pixels may differ, for anti-aliasing).
        expect(
          {
            left: boardBox?.x,
            top: boardBox?.y,
            right: (boardBox?.x ?? 0) + (boardBox?.width ?? 0),
          },
          'the board must span x 96..1824 from y 54',
        ).toEqual({ left: 96, top: 54, right: 1824 });
        const baselineName = `results-table-${name.replaceAll(' ', '-')}-${stage}.png`;
        await expect(
          page,
          `the results table (${name}, ${stage}) must match the baseline`,
        ).toHaveScreenshot(baselineName, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
