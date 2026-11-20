/**
 * Every page of the real field fits the bar (packages/graphics/lower-strip, Playwright)
 *
 * What this module is for:
 *   The strip shows six cars a page (decided in the brief), four when each car also shows
 *   its laps or its gap, three with both (BAJAOVRLAY-81), and never cuts a school's name
 *   nor shrinks a text. That holds only if every page of a real field fits the bar at the
 *   design's sizes with the real face, which only a browser can measure. This test renders
 *   the real 34-car field of the enduro on the built preview (the theme's tokens and Bebas
 *   Neue, as on air) and measures each of its pages.
 *
 * What these tests prove:
 *   - With the clock block, each of the six pages' pills at their natural width (not
 *     stretched) fit the bar's pages box (the bar is x 96..1824, the page cell after it),
 *     and no school name is cut.
 *   - Without the block, the same.
 *   - With the laps (four a page, 9 pages), the gap in laps (four a page; "+41 VOLTAS" is
 *     wider than any gap in time) and both (three a page, 12 pages), the same, with the
 *     clock block, where the bar leaves the least room.
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
 * preview's "Próxima página" calls), `pageCount` times: the whole field. The pills stretch to fill
 * the bar (flex: 1 1 auto), so their drawn edge always meets the box's; what the page needs
 * is their natural width, measured with each pill set to flex: none for a moment, plus the
 * gaps between them.
 */
async function measureEveryPage(page: Page, pageCount: number): Promise<PageMeasurement[]> {
  return page.evaluate(async (pagesToMeasure) => {
    type StripElement = HTMLElement & { turnToTheNextPageNow: () => Promise<void> };
    const strip = document.querySelector('baja-lower-strip') as StripElement;
    const root = strip.shadowRoot as ShadowRoot;
    const measurements = [];
    for (let pageIndex = 0; pageIndex < pagesToMeasure; pageIndex += 1) {
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
  }, pageCount);
}

/** Lists the pages expected, "1/n" to "n/n", each with its cars: full pages, then the rest. */
function listPagesExpected(carCount: number, carsPerPage: number): [string, number][] {
  const pageCount = Math.ceil(carCount / carsPerPage);
  return Array.from({ length: pageCount }, (_unused, index) => {
    const carsBefore = index * carsPerPage;
    const carsOnThisPage = Math.min(carsPerPage, carCount - carsBefore);
    return [`${String(index + 1)}/${String(pageCount)}`, carsOnThisPage];
  });
}

test.describe('the real 34-car field on the strip', () => {
  const fieldVariants = [
    // The design's strip: six a page, six pages.
    { name: 'with the clock block', query: '', carsPerPage: 6 },
    // The race clock card is up: the pages start at the left, still six a page.
    { name: 'without the clock block', query: '&clock=off', carsPerPage: 6 },
    // BAJAOVRLAY-81: each car with its laps, four a page.
    { name: 'with the laps', query: '&laps=on', carsPerPage: 4 },
    // The gap in laps is the widest gap ("+41 VOLTAS"), four a page.
    { name: 'with the gap in laps', query: '&gap=laps', carsPerPage: 4 },
    // Both cells, three a page; the page cell "1/12" takes a little more room.
    { name: 'with the laps and the gap', query: '&laps=on&gap=lapsAndTime', carsPerPage: 3 },
  ];

  for (const variant of fieldVariants) {
    test(`fits every page in the bar, no name cut, ${variant.name}`, async ({ page }) => {
      // Arrange: the built preview with the real field on air, and the pages expected.
      await openPreviewOnAir(page, variant.query);
      const pagesExpected = listPagesExpected(34, variant.carsPerPage);

      // Act: measure every page.
      const measurements = await measureEveryPage(page, pagesExpected.length);

      // Assert: the pages and their cars (the last one shorter), each page's pills at
      // their natural width no wider than the pages box, and no school name wider than
      // its cell.
      expect(
        measurements.map((measurement) => [measurement.pageCell, measurement.carCount]),
        `the pages and their cars, ${String(variant.carsPerPage)} a page`,
      ).toEqual(pagesExpected);
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
