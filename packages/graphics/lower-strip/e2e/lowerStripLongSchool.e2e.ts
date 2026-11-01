/**
 * A long school on the strip scrolls alone (packages/graphics/lower-strip, Playwright)
 *
 * What this module is for:
 *   The strip's pills share the bar (flex: 1 1 auto) and a school too long for its pill
 *   scrolls inside it (BAJAOVRLAY-55). Without a bound, one long school made every pill of
 *   its page shrink in proportion, so the short schools beside it came out 2 or 3 px too
 *   narrow and scrolled too: "UFPR" ending as "R". The school's box is bounded by the
 *   theme's `--strip-school-max-width`, so the long one scrolls and the others stay whole.
 *
 * What these tests prove:
 *   - On every page of the real 34-car field, with one school on the page replaced by
 *     "Universidade Tecnológica Federal do Paraná - Cornélio Procópio", that school is the
 *     only one cut (and so the only one that scrolls); the others are whole.
 *
 * What these tests deliberately do not cover:
 *   - The scroll itself; the kit's tests, and the tower's, the standings' and the bracket's
 *     long-names browser tests.
 *   - A page where every school is long: then they all scroll, as they must.
 */
import { readFileSync } from 'node:fs';

import { longestBajaSchoolNames } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** Six cars a page (stripPages.ts). */
const carsPerPage = 6;

/** One car of the field, the fields src/realEnduroField.ts reads for the preview. */
type SampleCar = {
  position: number;
  carNumber: number;
  teamName: string;
  schoolName: string;
  laps: number;
  status: string;
};

/** The real 34-car field (docs/design/sample-data.json), read as the preview reads it. */
function readRealEnduroField(): SampleCar[] {
  const sampleAddress = new URL('../../../../docs/design/sample-data.json', import.meta.url);
  const sample = JSON.parse(readFileSync(sampleAddress, 'utf8')) as { positions: SampleCar[] };
  return sample.positions.map((car) => ({
    position: car.position,
    carNumber: car.carNumber,
    teamName: car.teamName,
    schoolName: car.schoolName,
    laps: car.laps,
    status: car.status,
  }));
}

/** The real field, the first car of each page given the longest school in the field. */
function createRealFieldWithOneLongSchoolAPage() {
  return readRealEnduroField().map((car, index) => {
    const isFirstOfItsPage = index % carsPerPage === 0;
    return isFirstOfItsPage
      ? { ...car, schoolName: longestBajaSchoolNames.utfprCornelioProcopio }
      : car;
  });
}

/** Opens the preview with the field on air, the clock block shown and held. */
async function openStripWithField(page: Page, entries: unknown[]): Promise<void> {
  const stripData = {
    entries,
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: Date.now(),
    running: false,
    showClockBlock: true,
  };
  await page.goto(`preview.html?data=${encodeURIComponent(JSON.stringify(stripData))}`);
  await expect(page.locator('body'), 'the strip must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The schools cut on each page (wider than their box), turning through all six pages. */
async function listSchoolsCutOnEveryPage(page: Page): Promise<string[][]> {
  return page.evaluate(async () => {
    type StripElement = HTMLElement & { turnToTheNextPageNow: () => Promise<void> };
    const strip = document.querySelector('baja-lower-strip') as StripElement;
    const root = strip.shadowRoot as ShadowRoot;
    const cutOnEachPage: string[][] = [];
    for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
      const laneOnAir = [...root.querySelectorAll('[data-testid="lower-strip-lane"]')].find(
        (lane) => lane.getAttribute('aria-hidden') !== 'true',
      ) as HTMLElement;
      const schools = [
        ...laneOnAir.querySelectorAll<HTMLElement>('[data-testid="lower-strip-car-school"]'),
      ];
      cutOnEachPage.push(
        schools
          .filter((school) => school.scrollWidth > school.clientWidth)
          .map((school) => school.textContent ?? ''),
      );
      await strip.turnToTheNextPageNow();
    }
    return cutOnEachPage;
  });
}

test.describe('one long school on each page of the real field', () => {
  test('is the only school cut on its page; the short ones stay whole', async ({ page }) => {
    // Arrange: the real field, one school a page made the longest of the field.
    await openStripWithField(page, createRealFieldWithOneLongSchoolAPage());

    // Act: read which schools are cut on each of the six pages.
    const cutOnEachPage = await listSchoolsCutOnEveryPage(page);

    // Assert: on every page, the long school alone.
    const longSchool = longestBajaSchoolNames.utfprCornelioProcopio;
    expect(cutOnEachPage, 'only the long school may be cut, on every page').toEqual([
      [longSchool],
      [longSchool],
      [longSchool],
      [longSchool],
      [longSchool],
      [longSchool],
    ]);
  });
});
