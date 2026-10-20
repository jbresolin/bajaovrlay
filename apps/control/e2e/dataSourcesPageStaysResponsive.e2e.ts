/**
 * The "Fontes de dados" page stays responsive with a 60-car race (apps/control, Playwright)
 *
 * What this module is for:
 *   The Fontes page redraws a source's tables at every poll (every 0,5 s here, 60 cars).
 *   Gate 2 of PR #18 found it frozen: each correctable cell mounted its own menu and its own
 *   store subscription, about 360 of them, and the main thread was busy about 60 s out of
 *   67, so the operator's clicks waited and eight browser tests timed out. This test runs
 *   the race for ten seconds and then measures how quickly the page answers, so that kind
 *   of freeze fails here with a clear message instead of somewhere else as a timeout.
 *
 * What these tests prove:
 *   - After ten seconds of the 60-car simulator at 60×, read every 0,5 s, on a machine as
 *     slow as the CI runner, a round trip to the page (page.evaluate) answers within
 *     1,5 s, and no task in those ten seconds held the main thread longer than 1,5 s (the
 *     browser's long-task timing).
 *
 * Why the CPU is slowed off CI only, and why these bounds:
 *   The CI runner is the machine the freeze was found on (gate 2 of PR #18); the broken
 *   page's longest task took 737 ms there and 212 ms on a developer machine, so the runner
 *   is about 3,5 times slower. On CI the page runs as it is; anywhere else Chrome's CPU
 *   throttling slows it 4 times, to about the runner's speed. On a developer machine so
 *   slowed, the frozen page took 14,7 s to answer and the fixed one 25–790 ms (its longest
 *   task 280–370 ms). The fixed page only falls behind its polls at about 8 times slower
 *   (each poll's redraw in React's development build then outlasts the 0,5 s between
 *   polls), so the runner has about twice its speed in hand. 1,5 s is ten times under the
 *   freeze and twice the slowest fixed run. Slowing the runner 4 times on top took it past
 *   that point (10,9 s, the first CI run of gate 2).
 *
 * What these tests deliberately do not cover:
 *   - The corrections themselves; DataSourcesPageCorrections.test.tsx.
 *   - The console page, whose tables are not redrawn per poll.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 */
import { expect, test } from '@playwright/test';

import {
  openDataSourcesPageAndWaitUntilConnected,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The page's CPU is slowed this many times (Chrome's own throttling) off CI, so a fast
// developer machine sees what the CI runner sees; the runner is left as it is (header).
const cpuSlowdownFactor = process.env.CI === undefined ? 4 : 1;
// How long the race runs before the page is measured: twenty polls of 60 cars.
const raceRunningTimeBeforeTheMeasureInMilliseconds = 10_000;
// The frozen page answered in 14,7 s; the fixed one in at most 790 ms (see the header).
const longestRoundTripAllowedInMilliseconds = 1_500;
// The fixed page's longest task is about 370 ms here; the freeze held the thread for
// 737 ms at a time without the slowdown, some 3 s with it.
const longestTaskAllowedInMilliseconds = 1_500;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the "Fontes de dados" page during a 60-car race', () => {
  test('answers a round trip quickly and holds no long task after ten seconds of polls', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // Arrange: the page watching the browser's long tasks, and the simulator at 60×, read
    // every 0,5 s, its 60 cars shown.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    const devTools = await page.context().newCDPSession(page);
    await devTools.send('Emulation.setCPUThrottlingRate', { rate: cpuSlowdownFactor });
    await page.evaluate(() => {
      const windowWithTasks = window as unknown as { longestTaskMs: number };
      windowWithTasks.longestTaskMs = 0;
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          windowWithTasks.longestTaskMs = Math.max(windowWithTasks.longestTaskMs, entry.duration);
        }
      }).observe({ type: 'longtask', buffered: false });
    });

    // Act: let the race run, then time a round trip and read the longest task.
    await page.waitForTimeout(raceRunningTimeBeforeTheMeasureInMilliseconds);
    const roundTripStartMs = Date.now();
    const longestTaskMs = await page.evaluate(() => {
      const windowWithTasks = window as unknown as { longestTaskMs: number };
      return windowWithTasks.longestTaskMs;
    });
    const roundTripMs = Date.now() - roundTripStartMs;

    // Assert: the page answered quickly and nothing held it long.
    expect(roundTripMs, 'the page must answer a round trip quickly during the race').toBeLessThan(
      longestRoundTripAllowedInMilliseconds,
    );
    expect(longestTaskMs, 'no task may hold the page long during the race').toBeLessThan(
      longestTaskAllowedInMilliseconds,
    );
  });
});
