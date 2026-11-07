/**
 * The widest a monitor is ever drawn: a third of the stream's 1920 px. It is also the
 * centre column's width on a 1920x1080 screen (ConsoleView.tsx), the width at which both
 * stacked monitors still fit under the header without scrolling.
 */
export const largestMonitorWidthInPixels = 640;

/**
 * Says how wide EACH of the two stacked monitors is drawn in a centre column of this
 * width: the column's width in whole pixels, never wider than 640 px and never less than
 * 0. Both monitors get this one width, so they shrink together on a narrow window
 * (BAJAOVRLAY-59). The height is not decided here: the box is always 16:9 of its width.
 * A column that was not measured yet is 0 wide and gives 0: nothing is drawn for that
 * instant instead of a box that overflows.
 */
export function chooseMonitorWidthForColumnWidth(columnWidthInPixels: number): number {
  const columnWidthInWholePixels = Math.floor(columnWidthInPixels);
  const widthThatFits = Math.min(largestMonitorWidthInPixels, columnWidthInWholePixels);
  return Math.max(0, widthThatFits);
}
