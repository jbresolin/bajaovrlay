/** The widest a monitor is ever drawn: a quarter of the stream's 1920 px. */
export const largestMonitorWidthInPixels = 480;

/**
 * The space between the two monitors. PreviewAndProgramMonitors.tsx draws the gap from
 * this same number, so the arithmetic below and the page can never disagree.
 */
export const gapBetweenMonitorsInPixels = 16;

/**
 * Says how wide EACH of the two monitors is drawn in a centre column of this width: half
 * of what is left after the gap, in whole pixels, never wider than 480 px and never less
 * than 0. Both monitors get this one width, so they always fit side by side and shrink
 * together on a narrow window (João's ruling, gate 2 of BAJAOVRLAY-15). The height is
 * not decided here: the box is always 16:9 of its width.
 * A column that was not measured yet is 0 wide and gives 0: nothing is drawn for that
 * instant instead of two boxes that overflow.
 */
export function chooseMonitorWidthForColumnWidth(columnWidthInPixels: number): number {
  const widthLeftForTheTwoMonitors = columnWidthInPixels - gapBetweenMonitorsInPixels;
  const halfOfThatInWholePixels = Math.floor(widthLeftForTheTwoMonitors / 2);
  const widthThatFits = Math.min(largestMonitorWidthInPixels, halfOfThatInWholePixels);
  return Math.max(0, widthThatFits);
}
