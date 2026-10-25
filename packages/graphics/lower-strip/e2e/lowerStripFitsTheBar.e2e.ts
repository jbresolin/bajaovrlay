/**
 * Every page of the real field fits the bar (packages/graphics/lower-strip, Playwright)
 *
 * What this module is for:
 *   The strip shows six cars a page (decided in the brief) and never cuts a school's name.
 *   That holds only if every page of a real field fits the bar at the design's sizes with
 *   the real face, which only a browser can measure. This test renders the real 34-car
 *   field of the enduro on the built preview (the theme's tokens and Bebas Neue, as on air)
 *   and measures each of its six pages, with the clock block and without it.
 *
 * What these tests prove:
 *   - With the clock block, each of the six pages' pills at their natural width (not
 *     stretched) fit the bar's pages box (the bar is x 96..1824, the page cell after it),
 *     and no school name is cut.
 *   - Without the block, the same.
 *   - The bar sits in its slot: x 96 to 1824, bottom at y 1026, 72 px tall.
 *
 * What these tests deliberately do not cover:
 *   - A field other than the real one; the design measured pass 1's 60-car sample
 *     (README "The lower strip"), and stripPages.ts names the measurement.
 *   - The look; lowerStripScreenshots.e2e.ts compares it with its baselines.
 */
import { expect, type Page, test } from '@playwright/test';

/** What one page measures, read in the page. */
type PageMeasurement = {
  pageCell: string;
  carCount: number;
  naturalWidthPx: number;
  pagesBoxWidthPx: number;
  namesCut: string[];
};

/** Opens the preview on the grey stage (the clock held) and waits for it on air with its face. */
async function openPreviewOnAir(page: Page, query: string): Promise<void> {
  await page.goto(`preview.html?stage=grey${query}`);
  await expect(page.locator('body'), 'the strip must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Measures the page on air, then turns to the next one (the strip's own method, which the
 * preview's "Próxima página" calls), six times: the whole field. The pills stretch to fill
 * the bar (flex: 1 1 auto), so their drawn edge always meets the box's; what the page needs
 * is their natural width, measured with each pill set to flex: none for a moment, plus the
 * gaps between them.
 */
async function measureEveryPage(page: Page): Promise<PageMeasurement[]> {
  return page.evaluate(async () => {
    type StripElement = HTMLElement & { turnToTheNextPageNow: () => Promise<void> };
    const strip = document.querySelector('baja-lower-strip') as StripElement;
    const root = strip.shadowRoot as ShadowRoot;
    const measurements = [];
    for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
      const laneOnAir = [...root.querySelectorAll('[data-testid="lower-strip-lane"]')].find(
        (lane) => lane.getAttribute('aria-hidden') !== 'true',
      ) as HTMLElement;
      const pills = [...laneOnAir.querySelectorAll<HTMLElement>('[data-testid="lower-strip-car"]')];
      const pagesBox = laneOnAir.parentElement as HTMLElement;
      for (const pill of pills) {
        pill.style.flex = 'none';
      }
      const pillsWidthPx = pills.reduce((sum, pill) => sum + pill.getBoundingClientRect().width, 0);
      for (const pill of pills) {
        pill.style.flex = '';
      }
      const gapPx = Number.parseFloat(getComputedStyle(laneOnAir).columnGap);
      const naturalWidthPx = pillsWidthPx + gapPx * (pills.length - 1);
      const schools = [
        ...laneOnAir.querySelectorAll<HTMLElement>('[data-testid="lower-strip-car-school"]'),
      ];
      measurements.push({
        pageCell: root.querySelector('[data-testid="lower-strip-page-cell"]')?.textContent ?? '',
        carCount: pills.length,
        naturalWidthPx,
        pagesBoxWidthPx: pagesBox.getBoundingClientRect().width,
        namesCut: schools
          .filter((school) => school.scrollWidth > school.clientWidth)
          .map((school) => school.textContent ?? ''),
      });
      await strip.turnToTheNextPageNow();
    }
    return measurements;
  });
}

test.describe('the real 34-car field on the strip', () => {
  for (const variant of [
    { name: 'with the clock block', query: '' },
    { name: 'without the clock block', query: '&clock=off' },
  ]) {
    test(`fits every page in the bar, no name cut, ${variant.name}`, async ({ page }) => {
      // Arrange: the built preview with the real field on air.
      await openPreviewOnAir(page, variant.query);

      // Act: measure the six pages.
      const measurements = await measureEveryPage(page);

      // Assert: six pages of six (the last of four), each page's pills at their natural
      // width no wider than the pages box, and no school name wider than its cell.
      expect(
        measurements.map((measurement) => [measurement.pageCell, measurement.carCount]),
        'the six pages and their cars',
      ).toEqual([
        ['1/6', 6],
        ['2/6', 6],
        ['3/6', 6],
        ['4/6', 6],
        ['5/6', 6],
        ['6/6', 4],
      ]);
      for (const measurement of measurements) {
        expect(
          measurement.naturalWidthPx,
          `page ${measurement.pageCell} must fit the bar at its natural width`,
        ).toBeLessThanOrEqual(measurement.pagesBoxWidthPx);
        expect(measurement.namesCut, `no name may be cut on page ${measurement.pageCell}`).toEqual(
          [],
        );
      }
    });
  }

  test('sits in the ticker’s slot: x 96 to 1824, bottom at y 1026, 72 px tall', async ({
    page,
  }) => {
    // Arrange: the built preview with the real field on air.
    await openPreviewOnAir(page, '');

    // Act: measure the bar.
    const barBox = await page.getByTestId('lower-strip-bar').boundingBox();

    // Assert: the title-safe slot the design draws.
    expect(
      {
        left: barBox?.x,
        right: (barBox?.x ?? 0) + (barBox?.width ?? 0),
        bottom: (barBox?.y ?? 0) + (barBox?.height ?? 0),
        height: barBox?.height,
      },
      'the bar must sit in its slot',
    ).toEqual({ left: 96, right: 1824, bottom: 1026, height: 72 });
  });
});
