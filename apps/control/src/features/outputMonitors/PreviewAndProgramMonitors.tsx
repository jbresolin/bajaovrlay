import { useServerState } from '@/state/ControlPageStateProvider';

import {
  chooseMonitorWidthForColumnWidth,
  gapBetweenMonitorsInPixels,
} from './monitorWidthForColumnWidth';
import { OutputMonitor } from './OutputMonitor';
import { PreviewedLayersList } from './PreviewedLayersList';
import { useWidthOfElement } from './useWidthOfElement';

/**
 * The two monitors of the centre column, side by side: "Prévia" on the left, with the
 * lines of what is previewed under it, and "Programa" on the right. It reads left to
 * right as the show runs: look at it first, then it is on air.
 *
 * Each monitor is at most 480 px wide, so the pair wants 976 px. The centre column has
 * that on a 1920 px wide screen (1184 px are left between the two side columns) but not
 * on a 1600 px one (864 px). João's ruling (gate 2 of BAJAOVRLAY-15): the two always stay
 * side by side and shrink together to fit, both the same size and always 16:9. This row
 * measures its own width (it is as wide as the column, whatever is drawn inside it) and
 * monitorWidthForColumnWidth.ts says how wide each monitor is.
 * The price on a narrow screen: thin lines and small text of a graphic are harder to
 * read in a monitor smaller than a quarter of the stream.
 */
export function PreviewAndProgramMonitors() {
  const { elementToMeasureRef, widthInPixels: rowWidthInPixels } = useWidthOfElement();
  const monitorWidthInPixels = chooseMonitorWidthForColumnWidth(rowWidthInPixels);
  // Each monitor may show another output than program (BAJAOVRLAY-49).
  const outputs = useServerState((state) => state.outputs);

  return (
    <div
      ref={elementToMeasureRef}
      className="flex items-start"
      style={{ gap: gapBetweenMonitorsInPixels }}
    >
      {/* As wide as the monitor, so a long label under it is cut short instead of
          pushing "Programa" out of the row. */}
      <div className="flex shrink-0 flex-col gap-2" style={{ width: monitorWidthInPixels }}>
        <OutputMonitor output="preview" widthInPixels={monitorWidthInPixels} outputs={outputs} />
        <PreviewedLayersList />
      </div>
      <div className="shrink-0" style={{ width: monitorWidthInPixels }}>
        <OutputMonitor output="program" widthInPixels={monitorWidthInPixels} outputs={outputs} />
      </div>
    </div>
  );
}
