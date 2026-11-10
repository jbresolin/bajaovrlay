// Test support (chaos suite): counts the positions tower's rows on the output at every
// frame the browser draws, so a scenario proves the tower never lost a row, not only that
// its layer kept the graphic (gate 2 of PR #61). A graphic that stays on its layer but
// draws no rows is a blank tower all the same. Rows lifting out after a change are
// marked `is-leaving` and are not counted: they are no longer places.
import type { Page } from '@playwright/test';

/** What the page keeps: the tower's row count, each time it changed. */
type PageWithTowerRowCounts = { __towerRowCounts?: number[] };

/**
 * Starts the count. Call it before `page.goto`. From then on, at every animation frame,
 * the page notes how many rows the tower on the "tower" layer shows, when that differs
 * from the frame before (0 while there is no tower).
 */
export async function watchTheTowerRowsAtEveryFrame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pageWithCounts = window as unknown as PageWithTowerRowCounts;
    const rowCounts: number[] = [];
    pageWithCounts.__towerRowCounts = rowCounts;

    function noteTheTowerRowCountAtThisFrame(): void {
      const tower = document.querySelector(
        '[data-layer-id="tower"] > baja-graphic-positions-tower',
      );
      const rows = tower?.shadowRoot?.querySelectorAll(
        '[data-testid="positions-tower-row"]:not(.is-leaving)',
      );
      const rowCountNow = rows?.length ?? 0;
      if (rowCounts.at(-1) !== rowCountNow) {
        rowCounts.push(rowCountNow);
      }
      requestAnimationFrame(noteTheTowerRowCountAtThisFrame);
    }
    requestAnimationFrame(noteTheTowerRowCountAtThisFrame);
  });
}

/**
 * The tower's row counts, one per change, from the first frame it showed this many rows
 * on: [] when it never did. What came before (the tower drawing in) is left out.
 */
export async function readTowerRowCountsSinceItShowed(
  page: Page,
  startingRowCount: number,
): Promise<number[]> {
  const rowCounts = await page.evaluate(() => {
    const pageWithCounts = window as unknown as PageWithTowerRowCounts;
    return pageWithCounts.__towerRowCounts ?? [];
  });
  const firstFrameWithAllRows = rowCounts.indexOf(startingRowCount);
  if (firstFrameWithAllRows === -1) {
    return [];
  }
  return rowCounts.slice(firstFrameWithAllRows);
}
