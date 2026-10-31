/**
 * Positions tower: the frame budget with 20 names scrolling
 * (packages/graphics/positions-tower, Playwright)
 *
 * What this module is for:
 *   OBS draws the renderer page in Chromium at 60 frames a second, and a dropped frame is a
 *   visible stutter on the stream. A full tower page whose 20 names are all too long for
 *   the team column runs 20 scrolling texts at once (BAJAOVRLAY-55), as Web Animations of
 *   `transform` and `opacity`, which Chromium runs on its compositor thread. This test
 *   measures both what the scroll asks of the page's main thread and the frames drawn,
 *   against the same tower whose names all fit, where nothing moves.
 *
 * What these tests prove:
 *   - Over three seconds of scrolling, the main thread restyles and lays out no more than
 *     for the still tower (Chromium's own counters): the scroll asks nothing of it, so a
 *     busy main thread cannot make it stutter. A scroll driven from the main thread (the
 *     first version, a GSAP timeline) restyled every frame, about 180 times.
 *   - Over three seconds of frames, the scrolling tower drops no more frames than the still
 *     one (a frame of 25 ms or more, 1.5 × 16.7 ms, counts as dropped). On a machine where
 *     another program takes the cores the pair is measured again, at most three times; a
 *     real cost of the scroll would show in every attempt.
 *   - Every attempt's numbers are attached to the test's report ("frame budget").
 *
 * What these tests deliberately do not cover:
 *   - OBS itself and a GPU: headless Chromium on the test machine draws in software, so the
 *     frames compare the two towers with each other, not with a real stream. In software
 *     drawing the moving pixels cost the compositor CPU, so with six browsers sharing the
 *     cores the scrolling tower dropped frames where the still one, drawing nothing, did not.
 *   - The page turn and the play-in, which are not BAJAOVRLAY-55's.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import {
  longestBajaSchoolNames,
  waitForScrollPhase,
} from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { type CDPSession, expect, type Page, test } from '@playwright/test';

import { readEnduroSampleEntries } from './sampleEntries.js';

/** How long the frames are counted, in milliseconds. */
const measuringWindowMs = 3000;

/** A frame this long or longer missed its 60 Hz slot: 1.5 × 16.7 ms. */
const droppedFrameThresholdMs = 25;

/**
 * The text tokens of the measure: Ardósia's 2.5 s hold, then Ardósia's 60 px/s, so every
 * name is still scrolling through the windows; the end hold is long. The hold also lets
 * GSAP's frame loop fall asleep after the play-in (it stays awake about 120 frames, and
 * every main-thread frame it asks for restyles the running animations too) before the
 * scroll, and the measure, begin.
 */
const textTokensScrollingAtArdosiasSpeed: Record<string, string> = {
  '--motion-text-hold-start': '2500ms',
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

/** The main thread's work over the window, from Chromium's own counters. */
type MainThreadWork = {
  styleRecalculations: number;
  layouts: number;
  scriptMs: number;
};

/** One window measured: its frames and the main thread's work during it. */
type WindowMeasure = { frames: FrameNumbers; mainThread: MainThreadWork };

/** Reads Chromium's performance counters for the page (DevTools protocol). */
async function readPerformanceCounters(cdp: CDPSession): Promise<Map<string, number>> {
  const answer = await cdp.send('Performance.getMetrics');
  return new Map(answer.metrics.map((metric) => [metric.name, metric.value]));
}

/** Counts the page's frame intervals for the measuring window, in the page itself. */
async function countFrameIntervalsInThePage(page: Page): Promise<number[]> {
  return page.evaluate(async (windowMs) => {
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
}

/** Sums up frame intervals: count, mean, 95th percentile, slowest, dropped. */
function summariseFrameIntervals(intervals: number[]): FrameNumbers {
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

/**
 * Leaves the page alone for the measuring window, with no frame loop of the test's own: a
 * requestAnimationFrame loop makes Chromium run a main-thread frame every tick, and then
 * restyle every running animation in it, composited or not (a probe of one text gave 122
 * restyles in 2 s with the loop, 1 without). This window is a measure, not a wait for a
 * state, so it is timed.
 */
async function leaveThePageAloneForTheWindow(page: Page): Promise<void> {
  await page.evaluate(async (windowMs) => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, windowMs);
    });
  }, measuringWindowMs);
}

/**
 * Measures one tower: the main thread's work over a window with no frame loop of the
 * test's own, from Chromium's counters, then the frames over a second window.
 */
async function measureWindow(page: Page, cdp: CDPSession): Promise<WindowMeasure> {
  const before = await readPerformanceCounters(cdp);
  await leaveThePageAloneForTheWindow(page);
  const after = await readPerformanceCounters(cdp);
  const counted = (name: string) => (after.get(name) ?? 0) - (before.get(name) ?? 0);
  const intervals = await countFrameIntervalsInThePage(page);
  return {
    frames: summariseFrameIntervals(intervals),
    mainThread: {
      styleRecalculations: counted('RecalcStyleCount'),
      layouts: counted('LayoutCount'),
      scriptMs: counted('ScriptDuration') * 1000,
    },
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

/** The two towers measured one after the other, in one attempt. */
type Attempt = { stillTower: WindowMeasure; scrollingTower: WindowMeasure };

/** How many attempts the frames get when another program on the machine takes the cores. */
const attemptsAtMost = 3;

/** Measures the still tower, then the tower with 20 names scrolling, on the same page. */
async function measureStillThenScrollingTower(page: Page, cdp: CDPSession): Promise<Attempt> {
  await openCompactTowerOnAir(page, readEnduroSampleEntries().slice(0, 20));
  const stillTower = await measureWindow(page, cdp);
  await openCompactTowerOnAir(page, createTwentyEntriesWithLongNames());
  const teamBoxes = page.getByTestId('row-team-box');
  await expect(teamBoxes, 'the tower must show 20 rows').toHaveCount(20);
  await waitForScrollPhase(teamBoxes.last(), 'scrolling');
  const scrollingTower = await measureWindow(page, cdp);
  const phases = await teamBoxes.evaluateAll((boxes) =>
    boxes.map((box) => box.getAttribute('data-scroll-phase')),
  );
  expect(
    phases.filter((phase) => phase === 'scrolling'),
    'all 20 names must have been scrolling while measured',
  ).toHaveLength(20);
  return { stillTower, scrollingTower };
}

/** Whether the scrolling tower dropped no more frames than the still one in an attempt. */
function isWithinTheFrameBudget(attempt: Attempt): boolean {
  return attempt.scrollingTower.frames.dropped <= attempt.stillTower.frames.dropped;
}

test.describe('the tower with 20 names scrolling', () => {
  test('gives the main thread no more work than the still tower, and drops no more frames', async ({
    page,
  }, testInfo) => {
    // Arrange: room for three attempts (each two towers, four 3 s windows, a 2.5 s hold);
    // the theme's text tokens at Ardósia's hold and speed; Chromium's counters switched on.
    test.setTimeout(90_000);
    await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensScrollingAtArdosiasSpeed);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    // Act: measure both towers, again if another program on the machine took the cores
    // during an attempt (a real cost of the scroll would show in every attempt).
    const attempts: Attempt[] = [];
    for (let attemptNumber = 1; attemptNumber <= attemptsAtMost; attemptNumber += 1) {
      const attempt = await measureStillThenScrollingTower(page, cdp);
      attempts.push(attempt);
      if (isWithinTheFrameBudget(attempt)) {
        break;
      }
    }

    // Assert: every attempt is reported; the main thread did no per-frame work for the
    // scroll in any attempt (the compositor runs it); one attempt kept every frame.
    const numbers = { attempts, droppedFrameThresholdMs, measuringWindowMs };
    await testInfo.attach('frame budget', {
      body: JSON.stringify(numbers, null, 2),
      contentType: 'application/json',
    });
    testInfo.annotations.push({ type: 'frame budget', description: JSON.stringify(numbers) });
    for (const { stillTower, scrollingTower } of attempts) {
      // A few recalculations a window are the page's own (the clock block, a font check).
      expect(
        scrollingTower.mainThread.styleRecalculations,
        'the scroll must not restyle on the main thread every frame',
      ).toBeLessThanOrEqual(stillTower.mainThread.styleRecalculations + 5);
      expect(
        scrollingTower.mainThread.layouts,
        'the scroll must not lay the page out on the main thread',
      ).toBeLessThanOrEqual(stillTower.mainThread.layouts + 5);
    }
    expect(
      attempts.some(isWithinTheFrameBudget),
      'the scrolling tower must drop no more frames than the still one',
    ).toBe(true);
  });
});
