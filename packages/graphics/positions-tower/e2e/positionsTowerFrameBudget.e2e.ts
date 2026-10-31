/**
 * Positions tower: the frame budget with 20 names scrolling
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   OBS draws the renderer page in Chromium at 60 frames a second, and a dropped frame is a
 *   visible stutter on the stream. A full tower page whose 20 names are all too long for
 *   the team column runs 20 scrolling texts at once (BAJAOVRLAY-55): one GSAP timeline
 *   moving `transform` only. This test measures the frames while they scroll and compares
 *   them with the same tower whose names all fit, where nothing moves.
 *
 * What these tests prove:
 *   - Over three seconds of scrolling, the tower with 20 names scrolling drops no more
 *     frames than the still tower (a frame longer than 1.5 × 16.7 ms counts as dropped),
 *     and its slowest frames are no slower.
 *   - The numbers of both runs are attached to the test's report ("frame budget").
 *
 * What these tests deliberately do not cover:
 *   - OBS itself and a GPU: headless Chromium on the test machine draws in software, so the
 *     numbers compare the two towers with each other, not with a real stream.
 *   - The page turn and the play-in, which are not BAJAOVRLAY-55's.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  longestBajaSchoolNames,
  waitForScrollPhase,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

import { readEnduroSampleEntries } from './sampleEntries.js';

/** How long the frames are counted, in milliseconds. */
const measuringWindowMs = 3000;

/** A frame this long or longer missed its 60 Hz slot: 1.5 × 16.7 ms. */
const droppedFrameThresholdMs = 25;

/**
 * The text tokens of the measure: the scroll starts at once and runs at Ardósia's 60 px/s,
 * so every name is still scrolling through the three seconds; the end hold is long.
 */
const textTokensScrollingAtArdosiasSpeed: Record<string, string> = {
  '--motion-text-hold-start': '1ms',
  '--motion-text-scroll-speed': '60',
  '--motion-text-hold-end': '600000ms',
};

/** The long names given to the 20 cars: the two longest schools, each with its car number. */
function createTwentyEntriesWithLongNames() {
  const sampleEntries = readEnduroSampleEntries().slice(0, 20);
  return sampleEntries.map((entry, index) => {
    const isEven = index % 2 === 0;
    const longSchool = isEven
      ? longestBajaSchoolNames.utfprCornelioProcopio
      : longestBajaSchoolNames.iffItaperuna;
    return { ...entry, teamName: `${longSchool} ${String(entry.carNumber)}` };
  });
}

/** What the frames measured say. */
type FrameNumbers = {
  frames: number;
  meanMs: number;
  p95Ms: number;
  slowestMs: number;
  dropped: number;
};

/** Counts the page's frames for the measuring window, in the page itself. */
async function measureFramesInThePage(page: Page): Promise<FrameNumbers> {
  const intervals = await page.evaluate(async (windowMs) => {
    const frameIntervals: number[] = [];
    await new Promise<void>((resolve) => {
      let lastFrameAt: number | undefined;
      let startedAt: number | undefined;
      function onFrame(now: number): void {
        if (startedAt === undefined) {
          startedAt = now;
        }
        if (lastFrameAt !== undefined) {
          frameIntervals.push(now - lastFrameAt);
        }
        lastFrameAt = now;
        if (now - startedAt >= windowMs) {
          resolve();
          return;
        }
        requestAnimationFrame(onFrame);
      }
      requestAnimationFrame(onFrame);
    });
    return frameIntervals;
  }, measuringWindowMs);
  const sorted = [...intervals].sort((first, second) => first - second);
  const total = intervals.reduce((sum, interval) => sum + interval, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    frames: intervals.length,
    meanMs: total / intervals.length,
    p95Ms: sorted[p95Index] ?? 0,
    slowestMs: sorted[sorted.length - 1] ?? 0,
    dropped: intervals.filter((interval) => interval >= droppedFrameThresholdMs).length,
  };
}

/** Opens a compact 20-row tower on air with the given entries. */
async function openCompactTowerOnAir(page: Page, entries: unknown[]): Promise<void> {
  await page.goto(
    buildPreviewAddressWithData({ entries, layout: 'compact', paging: 'firstPageOnly' }),
  );
  await expect(page.locator('body'), 'the tower must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('the tower with 20 names scrolling', () => {
  test('drops no more frames than the tower with none scrolling', async ({ page }, testInfo) => {
    // Arrange: the theme's text tokens set to scroll at once at Ardósia's speed.
    await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensScrollingAtArdosiasSpeed);

    // Act: measure the still tower (the sample's short names), then the tower whose 20
    // names are too long, once every row is scrolling.
    await openCompactTowerOnAir(page, readEnduroSampleEntries().slice(0, 20));
    const stillTower = await measureFramesInThePage(page);
    await openCompactTowerOnAir(page, createTwentyEntriesWithLongNames());
    const teamCells = page.getByTestId('row-team');
    await expect(teamCells, 'the tower must show 20 rows').toHaveCount(20);
    await waitForScrollPhase(teamCells.last(), 'scrolling');
    const scrollingTower = await measureFramesInThePage(page);

    // Assert: the numbers are reported, then compared.
    const numbers = { stillTower, scrollingTower, droppedFrameThresholdMs, measuringWindowMs };
    await testInfo.attach('frame budget', {
      body: JSON.stringify(numbers, null, 2),
      contentType: 'application/json',
    });
    testInfo.annotations.push({ type: 'frame budget', description: JSON.stringify(numbers) });
    const scrollingPhases = await teamCells.evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute('data-scroll-phase')),
    );
    expect(
      scrollingPhases.filter((phase) => phase === 'scrolling'),
      'all 20 names must have been scrolling while measured',
    ).toHaveLength(20);
    expect(
      scrollingTower.dropped,
      'the scrolling tower must drop no more frames than the still one',
    ).toBeLessThanOrEqual(stillTower.dropped);
    expect(
      scrollingTower.slowestMs,
      'the slowest frame while scrolling must be no slower than a dropped frame',
    ).toBeLessThan(droppedFrameThresholdMs);
  });
});
