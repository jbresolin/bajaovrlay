/**
 * Standings screenshots on the design's grey and black stages
 * (packages/graphics/standings, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the standings in Ardósia
 *   is pinned by screenshots of preview.html?data=…&stage=… (the theme's tokens and font
 *   loaded as on air) at 1920×1080, compared against the baselines stored next to this
 *   file. The design they must match, side by side: docs/design/directions/ardosia/
 *   standings.html and standings-por-prova.html, and their screenshots/*.grey.jpg and
 *   *.black.jpg (PR #21).
 *
 * What these tests prove, on the grey (#7f7f7f) and the black (#0a0a0a) stage each:
 *   - The overall table with its parts, page 1: the head card with the logo, title, event
 *     and "1/3 · 1º A 20º", the column head, 20 pills of 40 px, Baja UFMG on the green
 *     chip, the muted parts with "−15" and Forja Baja's "—", the totals in green.
 *   - The board in columns: the enduro's 33 teams in two columns of tower pills, ties
 *     sharing a rank, "33 EQUIPES".
 *   - A disqualified team: page 3 of the overall table, the four disqualified teams last,
 *     dimmed, with "—" and "DESCL.".
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of the play-in (or of the turns to page 3). The page
 *     hold is made very long through a token override, so no timer turn lands in a shot.
 *   - The footage of the design's frame-1 shots; the grey and black stages are compared.
 *   - Other operating systems: baselines are rendered on Linux. After a deliberate visual
 *     change, refresh them with `pnpm --filter @bajaovrlay/standings test:e2e --update-snapshots`.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides';
import { expect, type Page, test } from '@playwright/test';

import { createEnduroStandings, createOverallStandingsWithParts } from '../src/previewData.js';

/** Waits until the last preview action has answered with the board on air. */
async function waitUntilOnAir(page: Page): Promise<void> {
  await expect(page.locator('body'), 'the standings must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/**
 * Opens the preview with the data on the stage, the page hold made 10 minutes long so no
 * page turns by itself, and waits for the play-in to end and the font to be ready.
 */
async function openPreviewOnAir(
  page: Page,
  data: Record<string, unknown>,
  stage: string,
): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, { '--motion-board-hold': '600000ms' });
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
  // The overall table with its six parts, page 1 (standings.html).
  {
    name: 'with parts page 1',
    data: createOverallStandingsWithParts(),
    turnsBeforeTheShot: 0,
  },
  // One event's table, the whole field in columns (standings-por-prova.html).
  {
    name: 'in columns',
    data: createEnduroStandings(),
    turnsBeforeTheShot: 0,
  },
  // Page 3 of the overall table ends with the four disqualified teams.
  {
    name: 'with a disqualified team',
    data: createOverallStandingsWithParts(),
    turnsBeforeTheShot: 2,
  },
];

const stages = ['grey', 'black'];

test.describe('the standings look like their baselines', () => {
  for (const { name, data, turnsBeforeTheShot } of boardScenarios) {
    for (const stage of stages) {
      test(`${name} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the preview on air with this board, turned to the page of the shot,
        // its buttons hidden.
        await openPreviewOnAir(page, data, stage);
        for (let turn = 0; turn < turnsBeforeTheShot; turn += 1) {
          await turnToTheNextPage(page);
        }
        await hidePreviewControls(page);

        // Act and assert: the whole 1920×1080 stage matches its baseline. A 1% pixel
        // tolerance absorbs anti-aliasing between GPU drivers without letting a colour
        // or a text change through.
        const baselineName = `standings-${name.replaceAll(' ', '-')}-${stage}.png`;
        await expect(
          page,
          `the standings (${name}, ${stage}) must match the baseline`,
        ).toHaveScreenshot(baselineName, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
