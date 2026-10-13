/**
 * How wide each monitor is drawn (apps/control)
 *
 * What this module is for:
 *   The centre column of the control page shows two monitors side by side, "Prévia" and
 *   "Programa", with a gap of 16 px between them. At their best they are 480 px wide
 *   each, a quarter of the stream's 1920 px. On a narrower window the column has less
 *   room than the 976 px the pair needs; João's ruling (gate 2 of BAJAOVRLAY-15) is that
 *   both then shrink together and stay side by side, instead of "Programa" dropping
 *   under "Prévia". `chooseMonitorWidthForColumnWidth` is told how wide the column is
 *   and answers how wide EACH monitor is drawn; the height always follows as 16:9.
 *
 * What these tests prove:
 *   - With room to spare each monitor is 480 px and never wider.
 *   - With exactly 976 px (two monitors and the gap) each is still 480 px; one pixel
 *     less and they start to shrink.
 *   - Below that each monitor is half of what is left after the gap, rounded down to a
 *     whole pixel, so the pair never overflows the column.
 *   - A column narrower than the gap, or not measured yet (0), gives 0 and never a
 *     negative width.
 *
 * What these tests deliberately do not cover:
 *   - Measuring the column and drawing the boxes: PreviewAndProgramMonitors.test.tsx.
 *   - The real layout in a browser: e2e/monitorsSideBySide.e2e.ts.
 */
import { describe, expect, it } from 'vitest';

import { chooseMonitorWidthForColumnWidth } from './monitorWidthForColumnWidth';

const monitorWidthScenarios = [
  // A 1920 px wide window leaves the centre column 1184 px: room to spare.
  {
    name: 'draws each monitor 480 px wide in a wide column, and no wider',
    columnWidthInPixels: 1184,
    expectedMonitorWidthInPixels: 480,
  },
  // The exact fit: 480 + 16 + 480.
  {
    name: 'still draws 480 px when the column is exactly two monitors and the gap',
    columnWidthInPixels: 976,
    expectedMonitorWidthInPixels: 480,
  },
  // One pixel short of the fit: the first width at which they must shrink.
  {
    name: 'starts to shrink one pixel below the exact fit',
    columnWidthInPixels: 975,
    expectedMonitorWidthInPixels: 479,
  },
  // The laptop the e2e runs at: a 1600 px wide window leaves the column 864 px.
  {
    name: 'draws each monitor 424 px wide in the 864 px column of a 1600 px window',
    columnWidthInPixels: 864,
    expectedMonitorWidthInPixels: 424,
  },
  // An odd number of pixels left: rounded down, so the pair never overflows.
  {
    name: 'rounds half a pixel down',
    columnWidthInPixels: 617,
    expectedMonitorWidthInPixels: 300,
  },
  // Narrower than the gap itself: nothing is left for the monitors, and never less.
  {
    name: 'gives zero, not a negative width, in a column narrower than the gap',
    columnWidthInPixels: 10,
    expectedMonitorWidthInPixels: 0,
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
        'each monitor must be half of the column minus the gap, at most 480 px and at least 0',
      ).toBe(expectedMonitorWidthInPixels);
    },
  );
});
