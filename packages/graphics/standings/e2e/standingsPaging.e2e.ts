/**
 * Standings paging, in the preview page (packages/graphics/standings, Playwright)
 *
 * What this module is for:
 *   The overall table holds 20 teams a page, so the real 54 teams take three pages: each
 *   is held `--motion-board-hold` (10 s in Ardósia), then the rows lift out together and
 *   the next page's rows cascade in, the head card staying and its page line changing.
 *   The timer is local to the graphic. These tests watch it in Chromium.
 *
 * What these tests prove:
 *   - The table shows rows 1–20 (car 2 first, "1/3 · 1º A 20º"), then 21–40 (car 7,
 *     "2/3 · 21º A 40º"), then 41–54 (car 52, "3/3 · 41º A 54º"), then page 1 again, each
 *     after one hold, on the same head card.
 *
 * How the hold is shortened:
 *   The graphic reads `--motion-board-hold` from :root before every hold, so the test
 *   declares `--motion-board-hold: 300ms` before the graphic loads (tokenOverrides.ts).
 *   The waits poll the board itself, never the clock; the exact timing of a turn is
 *   proven by the component test with fake time (src/standings.test.ts).
 *
 * What these tests deliberately do not cover:
 *   - The cascade itself; standingsAnimations.test.ts measures the timelines.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

import { createOverallStandingsWithParts } from '../src/previewData.js';

/** The car number of the first row and the head's page line, as one reading. */
async function readFirstCarAndPageLine(page: Page): Promise<string> {
  const firstCar = await page.getByTestId('standings-row').first().getAttribute('data-car-number');
  const pageLine = await page.getByTestId('standings-page-line').textContent();
  return `car ${String(firstCar)} · ${String(pageLine)}`;
}

test.describe('paging', () => {
  test('turns through the three pages of the overall table and back, keeping the head card', async ({
    page,
  }) => {
    // Arrange: a 300 ms hold on :root before the graphic loads, then the preview with the
    // real overall standings on air; the head card noted.
    await placeTokenOverridesBeforeTheGraphicLoads(page, { '--motion-board-hold': '300ms' });
    await page.goto(buildPreviewAddressWithData(createOverallStandingsWithParts()));
    await expect(page.locator('body'), 'the standings must be on air').toHaveAttribute(
      'data-preview-state',
      'onAir',
    );
    const pageOneReading = await readFirstCarAndPageLine(page);
    const headAtTheStart = await page.getByTestId('standings-head').evaluateHandle((head) => head);

    // Act: wait for each page in turn, sending nothing.
    await expect
      .poll(() => readFirstCarAndPageLine(page), { message: 'page 2 must come after the hold' })
      .toBe('car 7 · 2/3 · 21º A 40º');
    await expect
      .poll(() => readFirstCarAndPageLine(page), { message: 'page 3 must come after page 2' })
      .toBe('car 52 · 3/3 · 41º A 54º');
    await expect
      .poll(() => readFirstCarAndPageLine(page), { message: 'page 1 must come back after 3' })
      .toBe('car 2 · 1/3 · 1º A 20º');
    const isTheSameHead = await page
      .getByTestId('standings-head')
      .evaluate((head, headBefore) => head === headBefore, headAtTheStart);

    // Assert: page 1 started with the leader, the pages turned in order (the polls above)
    // and the head card never changed.
    expect(pageOneReading, 'page 1 must start with Baja UFMG, car 2').toBe(
      'car 2 · 1/3 · 1º A 20º',
    );
    expect(isTheSameHead, 'the head card must stay through the page turns').toBe(true);
  });
});
