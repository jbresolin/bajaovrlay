/**
 * A page's watch on the server's build (packages/shared)
 *
 * What this module is for:
 *   The control page and the renderer hand every build a hello names to this watch. It
 *   reloads the page when the build differs from the page's, at most once a minute, and
 *   when it skipped a reload as too recent it looks once more when the minute is over,
 *   so a second upgrade within the minute is not left until the next reconnect.
 *
 * What these tests prove (with the page's clock, reload, storage and timers stood in):
 *   - A skipped reload arms one timer for what is left of the minute, and when it fires
 *     a page still on another build reloads.
 *   - The second look compares the build of the latest hello: if that one is the page's
 *     own, nothing reloads.
 *   - Several hellos within the minute arm one timer, not one each.
 *   - Stopping the watch cancels the waiting timer.
 *
 * What these tests deliberately do not cover:
 *   - The comparison and the once-a-minute rule themselves; reloadForNewServerBuild.test.ts.
 *   - The log lines and each page's wiring; the serverConnection.buildReload tests of
 *     apps/control and apps/renderer.
 */
import { describe, expect, it } from 'vitest';

import type { PageReloadForNewBuild } from './reloadForNewServerBuild.js';
import { startServerBuildWatch } from './serverBuildWatch.js';

// The build of yesterday's page, this morning's upgrade, and a typo fix 40 seconds later.
const buildOfThisPage = '2026-10-18T09:12:44.103Z';
const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';
const buildOfTheTypoFix = '2026-10-19T07:40:42.907Z';
// 10:15 in Brasília on 19 October 2026, when the first hello arrives.
const momentOfTheFirstHelloMs = Date.parse('2026-10-19T13:15:00.000Z');

/** One timer the watch armed, which the test fires or finds cancelled. */
type TimerArmedByTheWatch = {
  callback: () => void;
  waitInMilliseconds: number;
  isCancelled: boolean;
};

/**
 * A watch on a page loaded from yesterday's build, with a clock the test moves, a reload
 * it counts, a sessionStorage that outlives a reload, and timers the test fires by hand.
 */
function startWatchOnAPageFromYesterday() {
  let nowMs = momentOfTheFirstHelloMs;
  let numberOfReloads = 0;
  const sessionEntries = new Map<string, string>();
  const timersArmed: TimerArmedByTheWatch[] = [];
  const pageReload: PageReloadForNewBuild = {
    pageBuildId: buildOfThisPage,
    readNowMs: () => nowMs,
    reloadPage: () => {
      numberOfReloads += 1;
    },
    openReloadMemory: () => ({
      getItem: (key) => sessionEntries.get(key) ?? null,
      setItem: (key, value) => {
        sessionEntries.set(key, value);
      },
    }),
  };
  const watch = startServerBuildWatch({
    pageReload,
    logBuildEvent: () => undefined,
    startTimer: (callback, waitInMilliseconds) => {
      const timer = { callback, waitInMilliseconds, isCancelled: false };
      timersArmed.push(timer);
      return () => {
        timer.isCancelled = true;
      };
    },
  });
  return {
    watch,
    timersArmed,
    letTimePass: (milliseconds: number) => {
      nowMs += milliseconds;
    },
    countReloads: () => numberOfReloads,
  };
}

/** Fires the one timer the watch armed, as the browser would once its wait is over. */
function fireTheOnlyTimer(timersArmed: TimerArmedByTheWatch[]): void {
  const [timer] = timersArmed;
  if (timersArmed.length !== 1 || timer === undefined) {
    throw new Error(`expected exactly one armed timer, found ${timersArmed.length}`);
  }
  timer.callback();
}

describe('the second look once the minute is over', () => {
  it('reloads a page still on another build once the minute is over', () => {
    // Arrange: the page reloaded for this morning's build, and 20 seconds later the
    // reloaded page hears of the typo fix, which it does not carry either.
    const page = startWatchOnAPageFromYesterday();
    page.watch.compareWithTheServerBuild(buildOfTheUpgradedServer);
    page.letTimePass(20_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);

    // Act: the rest of the minute passes and the timer fires.
    page.letTimePass(40_000);
    fireTheOnlyTimer(page.timersArmed);

    // Assert: the timer waited the 40 seconds left, and the page reloaded a second time.
    expect(
      page.timersArmed.map((timer) => timer.waitInMilliseconds),
      'the timer must wait what is left of the minute',
    ).toEqual([40_000]);
    expect(page.countReloads(), 'the skipped reload must happen at the second look').toBe(2);
  });

  it('reloads nothing at the second look when the latest hello named the page build', () => {
    // Arrange: a skipped reload 20 seconds after the last one, then a hello naming the
    // page's own build (the server was put back on it).
    const page = startWatchOnAPageFromYesterday();
    page.watch.compareWithTheServerBuild(buildOfTheUpgradedServer);
    page.letTimePass(20_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);
    page.watch.compareWithTheServerBuild(buildOfThisPage);

    // Act: the rest of the minute passes and the timer fires.
    page.letTimePass(40_000);
    fireTheOnlyTimer(page.timersArmed);

    // Assert: only the first reload happened.
    expect(page.countReloads(), 'the second look must compare the latest build').toBe(1);
  });

  it('arms one timer however many hellos come within the minute', () => {
    // Arrange: a page that reloaded for this morning's build.
    const page = startWatchOnAPageFromYesterday();
    page.watch.compareWithTheServerBuild(buildOfTheUpgradedServer);

    // Act: three reconnects within the minute, each hello naming the typo fix.
    page.letTimePass(10_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);
    page.letTimePass(10_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);
    page.letTimePass(10_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);

    // Assert: one timer, armed at the first skipped reload.
    expect(page.timersArmed.length, 'only one second look may wait at a time').toBe(1);
  });

  it('cancels the waiting second look when the watch is stopped', () => {
    // Arrange: a skipped reload, so a second look is waiting.
    const page = startWatchOnAPageFromYesterday();
    page.watch.compareWithTheServerBuild(buildOfTheUpgradedServer);
    page.letTimePass(20_000);
    page.watch.compareWithTheServerBuild(buildOfTheTypoFix);

    // Act: the page hangs up.
    page.watch.stop();

    // Assert: the waiting timer was cancelled.
    expect(
      page.timersArmed.map((timer) => timer.isCancelled),
      'the waiting second look must be cancelled',
    ).toEqual([true]);
  });
});
