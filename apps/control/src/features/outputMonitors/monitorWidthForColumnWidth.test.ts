/**
 * How wide each monitor is drawn (apps/control)
 *
 * What this module is for:
 *   The centre column of the console shows "Prévia" above "Programa" (BAJAOVRLAY-59;
 *   side by side before that). Stacked, each monitor can be as wide as the column, and at
 *   its best that is 640 px, a third of the stream's 1920 px: on a 1920x1080 screen the
 *   column is exactly that wide (ConsoleView.tsx). On a narrower window the column is
 *   narrower and both monitors shrink together, still stacked, both the same size.
 *   `chooseMonitorWidthForColumnWidth` is told how wide the column is and answers how wide
 *   EACH monitor is drawn; the height always follows as 16:9.
 *
 * What these tests prove:
 *   - In the 640 px column of a 1920 px window each monitor is 640 px, and never wider
 *     even if the column were.
 *   - In a narrower column each monitor is exactly as wide as the column, so the
 *     1366 px window's 448 px column gives 448 px.
 *   - A fraction of a pixel is rounded down, so a monitor never overflows the column.
 *   - A column not measured yet (0) gives 0 and never a negative width.
 *
 * What these tests deliberately do not cover:
 *   - Measuring the column and drawing the boxes: PreviewAndProgramMonitors.test.tsx.
 *   - The real layout in a browser: e2e/consoleLayout.e2e.ts.
 */
import { describe, expect, it } from 'vitest';

import { chooseMonitorWidthForColumnWidth } from './monitorWidthForColumnWidth';

const monitorWidthScenarios = [
  // A 1920 px wide window: the centre column is 640 px, and so is each monitor.
  {
    name: 'draws each monitor 640 px wide in the 640 px column of a 1920 px window',
    columnWidthInPixels: 640,
    expectedMonitorWidthInPixels: 640,
  },
  // Should a column ever be wider, the monitor still stops at a third of the stream.
  {
    name: 'never draws a monitor wider than 640 px',
    columnWidthInPixels: 900,
    expectedMonitorWidthInPixels: 640,
  },
  // The 1600 px breakpoint gives the centre 544 px.
  {
    name: 'draws each monitor 544 px wide in the 544 px column of a 1600 px window',
    columnWidthInPixels: 544,
    expectedMonitorWidthInPixels: 544,
  },
  // The smallest console the brief names: a 1366x768 laptop, whose centre is 448 px.
  {
    name: 'draws each monitor 448 px wide in the 448 px column of a 1366 px window',
    columnWidthInPixels: 448,
    expectedMonitorWidthInPixels: 448,
  },
  // A zoomed page can measure a fraction: rounded down, so the box never overflows.
  {
    name: 'rounds a fraction of a pixel down',
    columnWidthInPixels: 447.6,
    expectedMonitorWidthInPixels: 447,
  },
  // Before the page has measured its column it knows a width of 0.
  {
    name: 'gives zero for a column that was not measured yet',
    columnWidthInPixels: 0,
    expectedMonitorWidthInPixels: 0,
  },
];

describe('chooseMonitorWidthForColumnWidth', () => {
  it.each(monitorWidthScenarios)(
    '$name',
    ({ columnWidthInPixels, expectedMonitorWidthInPixels }) => {
      // Arrange: the width of the centre column of this row.
      const widthOfTheCentreColumn = columnWidthInPixels;

      // Act: ask how wide each monitor is drawn.
      const monitorWidthInPixels = chooseMonitorWidthForColumnWidth(widthOfTheCentreColumn);

      // Assert: the width of this row.
      expect(
        monitorWidthInPixels,
        'each monitor must be as wide as the column, in whole pixels, at most 640 px and at least 0',
      ).toBe(expectedMonitorWidthInPixels);
    },
  );
});
