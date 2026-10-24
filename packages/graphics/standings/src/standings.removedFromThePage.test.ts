/**
 * The standings web component: removed from the page (packages/graphics/standings)
 *
 * What this module is for:
 *   A renderer may take the standings' layer out of the page without calling dispose
 *   first (a layer cleared, a page rebuilt). standings.ts stops its page timer when the
 *   element leaves the document, so a board nobody sees never goes on turning pages.
 *
 * What these tests prove:
 *   - The table on air with three pages, removed from the page, is still on page 1 once
 *     the hold has passed, the hold driven by fake time.
 *
 * What these tests deliberately do not cover:
 *   - The page timer while the board stays on the page, stop and dispose, which
 *     standings.test.ts covers.
 *   - Putting a removed board back on the page: the timer is not restarted then; a
 *     renderer loads a new element for a new layer.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createOverallStandingsWithParts } from './previewData.js';
import {
  createStandingsOnThePage,
  loadStandingsWithData,
  placeTokensOnTheRoot,
  readPageLine,
} from './standingsOnThePage.testSupport.js';

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('a standings board removed from the page', () => {
  it('turns no page once removed while on air, the hold passing', async () => {
    // Arrange: Ardósia's 10 s hold, timers under the test's control, and the overall
    // table of 54 teams (three pages) on air with the page timer armed.
    placeTokensOnTheRoot({ '--motion-board-hold': '10000ms' });
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });

    // Act: the renderer takes the layer out of the page, then one hold passes (a single
    // hold: three would cycle a turning board back to page 1 and hide a turn).
    standings.remove();
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: still page 1, so no timer is left turning a board nobody sees.
    expect(readPageLine(standings), 'no page may turn once the board is removed').toBe(
      '1/3 · 1º A 20º',
    );
  });
});
