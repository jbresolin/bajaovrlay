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
 *     wider than any gap in time), the gap in time on a synthetic field of the real schools
 *     all on the leader's lap ("+357,7" at most), and both cells (three a page, 12 pages),
 *     the same, with the clock block, where the bar leaves the least room.
 *   - The bar sits in its slot: x 96 to 1824, bottom at y 1026, 72 px tall.
 *
 * What these tests deliberately do not cover:
 *   - A field other than the real one; the design measured pass 1's 60-car sample
 *     (README "The lower strip"), and stripPages.ts names the measurement.
 *   - The look; lowerStripScreenshots.e2e.ts compares it with its baselines.
 */
import { readFileSync } from 'node:fs';

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

/** The six-a-page pages of the 34 cars: five of six, the last of four. */
const sixPagesOfSix: [string, number][] = [
  ['1/6', 6],
  ['2/6', 6],
  ['3/6', 6],
  ['4/6', 6],
  ['5/6', 6],
  ['6/6', 4],
];

/** The four-a-page pages of the 34 cars: eight of four, the last of two. */
const ninePagesOfFour: [string, number][] = [
  ['1/9', 4],
  ['2/9', 4],
  ['3/9', 4],
  ['4/9', 4],
  ['5/9', 4],
  ['6/9', 4],
  ['7/9', 4],
  ['8/9', 4],
  ['9/9', 2],
];

/** The three-a-page pages of the 34 cars: eleven of three, the last of one. */
const twelvePagesOfThree: [string, number][] = [
  ['1/12', 3],
  ['2/12', 3],
  ['3/12', 3],
  ['4/12', 3],
  ['5/12', 3],
  ['6/12', 3],
  ['7/12', 3],
  ['8/12', 3],
  ['9/12', 3],
  ['10/12', 3],
  ['11/12', 3],
  ['12/12', 1],
];

/**
 * The real 34 schools all on the leader's lap, for the gap in time: every car but the
 * leader from "+301,7" up to "+357,7": as wide as a gap on the leader's lap gets, a lap
 * of the enduro taking about 3 to 6 minutes. Synthetic: the real field ended with every
 * car lapped, so it carries no time gap at all.
 */
function createRealSchoolsOnTheLeadersLapData(options: { isLapsShown: boolean }): object {
  const sampleAddress = new URL('../../../../docs/design/sample-data.json', import.meta.url);
  const sample = JSON.parse(readFileSync(sampleAddress, 'utf8')) as {
    positions: { position: number; carNumber: number; schoolName: string }[];
  };
  const entries = sample.positions.map((car, index) => {
    const entry = {
      position: car.position,
      carNumber: car.carNumber,
      schoolName: car.schoolName,
      laps: 43,
    };
    if (index === 0) {
      return entry;
    }
    return { ...entry, gapToLeaderMs: 300_000 + index * 1_750 };
  });
  return {
    entries,
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: 0,
    running: false,
    showLaps: options.isLapsShown,
    gapDisplay: 'time',
  };
}

/** The address query giving the preview this data. */
function writeDataQuery(data: object): string {
  return `&data=${encodeURIComponent(JSON.stringify(data))}`;
}

test.describe('the real 34-car field on the strip', () => {
  const fieldVariants = [
    // The design's strip: six a page, six pages.
    { name: 'with the clock block', query: '', pagesExpected: sixPagesOfSix },
    // The race clock card is up: the pages start at the left, still six a page.
    { name: 'without the clock block', query: '&clock=off', pagesExpected: sixPagesOfSix },
    // BAJAOVRLAY-81: each car with its laps, four a page.
    { name: 'with the laps', query: '&laps=on', pagesExpected: ninePagesOfFour },
    // The gap in laps is the widest gap ("+41 VOLTAS"), four a page.
    { name: 'with the gap in laps', query: '&gap=laps', pagesExpected: ninePagesOfFour },
    // "Só tempo" on cars all on the leader's lap ("+357,7" at most), four a page.
    {
      name: 'with the gap in time',
      query: writeDataQuery(createRealSchoolsOnTheLeadersLapData({ isLapsShown: false })),
      pagesExpected: ninePagesOfFour,
    },
    // Both cells, three a page; the page cell "1/12" takes a little more room.
    {
      name: 'with the laps and the gap',
      query: '&laps=on&gap=lapsAndTime',
      pagesExpected: twelvePagesOfThree,
    },
    // Both cells with the gap in time, three a page.
    {
      name: 'with the laps and the gap in time',
      query: writeDataQuery(createRealSchoolsOnTheLeadersLapData({ isLapsShown: true })),
      pagesExpected: twelvePagesOfThree,
    },
  ];

  for (const variant of fieldVariants) {
    test(`fits every page in the bar, no name cut, ${variant.name}`, async ({ page }) => {
      // Arrange: the built preview with the field on air.
      await openPreviewOnAir(page, variant.query);

      // Act: measure every page.
      const measurements = await measureEveryPage(page, variant.pagesExpected.length);

      // Assert: the pages and their cars (the last one shorter), each page's pills at
      // their natural width no wider than the pages box, and no school name wider than
      // its cell.
      expect(
        measurements.map((measurement) => [measurement.pageCell, measurement.carCount]),
        'the pages and their cars',
      ).toEqual(variant.pagesExpected);
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
