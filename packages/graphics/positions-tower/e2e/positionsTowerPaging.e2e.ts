/**
 * Positions tower paging, in the preview page (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   The field has 60 cars and the tower holds 20, so it pages through the field:
 *   with `paging: cycle` every page is held for `--motion-strip-hold` (7 s in Ardósia)
 *   and then the rows leave together and the next page's rows cascade in, the head
 *   staying; with `firstPageOnly` page 1 is held for good. The timer is local to the
 *   graphic (decision 15 of the context pack). These tests watch it in Chromium.
 *
 * What these tests prove:
 *   - With cycle, the tower shows cars 1–20 (car 31 first), then 21–40 (car 6 first),
 *     then 41–60 (car 5 first), then 1–20 again, each after one hold, on the same head.
 *   - With firstPageOnly, page 1 is still on air well after a hold would have passed.
 *
 * How the hold is shortened:
 *   The graphic reads `--motion-strip-hold` from :root when it arms each hold, so the
 *   7 s would make these tests slow. The tests declare `--motion-strip-hold: 300ms` on
 *   :root BEFORE the graphic loads (tokenOverrides.ts: an init script appends a style
 *   tag as soon as the document is parsed, before the page's module runs), which is
 *   the one way a token change reaches a timeline or a hold the graphic builds later.
 *
 * What these tests deliberately do not cover:
 *   - The cascade itself; the unit tests measure the timelines and the screenshots
 *     show the end state.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides';
import { expect, type Page, test } from '@playwright/test';

import { readEnduroSampleEntries } from './sampleEntries.js';

/** The car number of the first row on air. */
function readFirstCarNumberOnAir(page: Page): Promise<string | null> {
  return page.getByTestId('positions-tower-row').first().getAttribute('data-car-number');
}

/** Opens the preview with the sample and the given paging, and waits for the play-in. */
async function openPreviewWithPaging(page: Page, paging: string): Promise<void> {
  await page.goto(buildPreviewAddressWithData({ entries: readEnduroSampleEntries(), paging }));
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

test.describe('paging', () => {
  test('cycles through the three pages of the field and back, keeping the head', async ({
    page,
  }) => {
    // Arrange: a 300 ms hold on :root before the graphic loads, then the preview with
    // the sample cycling; the head element noted.
    await placeTokenOverridesBeforeTheGraphicLoads(page, { '--motion-strip-hold': '300ms' });
    await openPreviewWithPaging(page, 'cycle');
    const firstCarOnPageOne = await readFirstCarNumberOnAir(page);
    const headAtTheStart = await page
      .getByTestId('positions-tower-head')
      .evaluateHandle((head) => head);

    // Act: wait for each page in turn, without sending anything.
    await expect
      .poll(() => readFirstCarNumberOnAir(page), { message: 'page 2 must come after the hold' })
      .toBe('6');
    await expect
      .poll(() => readFirstCarNumberOnAir(page), { message: 'page 3 must come after page 2' })
      .toBe('5');
    await expect
      .poll(() => readFirstCarNumberOnAir(page), { message: 'page 1 must come back after page 3' })
      .toBe('31');
    const isTheSameHead = await page
      .getByTestId('positions-tower-head')
      .evaluate((head, headBefore) => head === headBefore, headAtTheStart);

    // Assert: page 1 started with the leader, the pages turned in order (the polls
    // above), and the head never changed.
    expect(firstCarOnPageOne, 'page 1 must start with the leader, car 31').toBe('31');
    expect(isTheSameHead, 'the head pill must stay through the page turns').toBe(true);
  });

  test('holds page 1 with firstPageOnly, however long the hold would be', async ({ page }) => {
    // Arrange: the same 300 ms hold, the preview with the sample held on page 1.
    await placeTokenOverridesBeforeTheGraphicLoads(page, { '--motion-strip-hold': '300ms' });
    await openPreviewWithPaging(page, 'firstPageOnly');

    // Act and first assert: watch the first row for five holds' worth of time, looking
    // every 100 ms (a fixed wait would miss a page that turned and came back; the watch
    // remembers it), and demand that page 1 was there the whole time.
    const fiveHoldsMs = 1500;
    const watchStartedAt = Date.now();
    let wasAnotherPageSeen = false;
    await expect
      .poll(
        async () => {
          const firstCar = await readFirstCarNumberOnAir(page);
          wasAnotherPageSeen = wasAnotherPageSeen || firstCar !== '31';
          if (wasAnotherPageSeen) {
            return `another page was seen (car ${firstCar} first)`;
          }
          const hasTheTimePassed = Date.now() - watchStartedAt >= fiveHoldsMs;
          return hasTheTimePassed ? 'page 1 held for five holds' : 'still watching page 1';
        },
        { message: 'page 1 must stay on air for five holds', intervals: [100], timeout: 5000 },
      )
      .toBe('page 1 held for five holds');

    // Assert: page 1 still holds its 20 rows.
    await expect(page.getByTestId('positions-tower-row'), 'page 1 holds 20 rows').toHaveCount(20);
  });
});
