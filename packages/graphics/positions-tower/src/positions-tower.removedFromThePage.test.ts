/**
 * The positions tower web component: removed from the page (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   A renderer may take a tower's layer out of the page without calling dispose first (a
 *   layer cleared, a page rebuilt). positions-tower.ts stops its page timer when the
 *   element leaves the document, so a tower nobody sees never goes on turning pages.
 *
 * What these tests prove:
 *   - A tower on air with several pages, removed from the page, is still on page 1 once
 *     the hold has passed, the hold driven by fake time.
 *
 * What these tests deliberately do not cover:
 *   - The page timer while the tower stays on the page, stop and dispose, which
 *     positions-tower.test.ts covers.
 *   - Putting a removed tower back on the page: the timer is not restarted then; a
 *     renderer loads a new element for a new layer.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createCompactTowerDataOnTheSample,
  createTowerOnThePage,
  loadTowerWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnThePage,
} from './positionsTowerOnThePage.testSupport.js';

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('a tower removed from the page', () => {
  it('turns no page once removed while on air, the hold passing', async () => {
    // Arrange: the 7 s hold and 20 rows a page from the theme, timers under the test's
    // control, and the 60-car sample on air with the page timer armed.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms', '--tower-rows-per-page': '20' });
    takeControlOfTimers();
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: the renderer takes the layer out of the page, then one hold passes (a single
    // hold: three would cycle a turning tower back to page 1 and hide a turn).
    tower.remove();
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: still page 1, the leader (car 31) on top: no timer turned a hidden tower.
    expect(
      readCarNumbersOnThePage(tower)[0],
      'no page may turn once the tower is removed from the page',
    ).toBe(31);
  });
});
