import { useServerState } from '@/state/ControlPageStateProvider';

import { chooseMonitorWidthForColumnWidth } from './monitorWidthForColumnWidth';
import { OutputMonitor } from './OutputMonitor';
import { PreviewedLayersList } from './PreviewedLayersList';
import { useWidthOfElement } from './useWidthOfElement';

/**
 * The two monitors of the centre column, stacked: "Prévia" on top, with the lines of what
 * is previewed under it, and "Programa" below. It reads top to bottom as the show runs:
 * look at it first, then it is on air.
 *
 * Stacked since BAJAOVRLAY-59 (side by side before, João's ruling at gate 2 of
 * BAJAOVRLAY-15): the centre became narrower so the right column, where the operator
 * works most, could be the widest, and one above the other each monitor is as wide as the
 * column, 640 px on a 1920 px screen instead of 480 px. Both are always the same size and
 * 16:9, and shrink together on a narrower window. This column measures its own width (it
 * is as wide as the grid makes it, whatever is drawn inside) and
 * monitorWidthForColumnWidth.ts says how wide each monitor is.
 * What could go wrong: every line under "Prévia" pushes "Programa" down. The bottom of
 * "Programa" is about 910 px down with one line; a 1080 px tall page has room for three
 * more lines and "Tomar tudo", but a maximised browser window on a 1080 px screen (about
 * 950 px) only for the one. The lines stay under "Prévia" anyway: they take its preview.
 */
export function PreviewAndProgramMonitors() {
  const { elementToMeasureRef, widthInPixels: columnWidthInPixels } = useWidthOfElement();
  const monitorWidthInPixels = chooseMonitorWidthForColumnWidth(columnWidthInPixels);
  // Each monitor may show another output than program (BAJAOVRLAY-49).
  const outputs = useServerState((state) => state.outputs);

  return (
    <div ref={elementToMeasureRef} className="flex min-w-0 flex-col gap-4">
      {/* As wide as the monitor, so a long label under it is cut short instead of
          widening the column. */}
      <div className="flex flex-col gap-2" style={{ width: monitorWidthInPixels }}>
        <OutputMonitor output="preview" widthInPixels={monitorWidthInPixels} outputs={outputs} />
        <PreviewedLayersList />
      </div>
      <div style={{ width: monitorWidthInPixels }}>
        <OutputMonitor output="program" widthInPixels={monitorWidthInPixels} outputs={outputs} />
      </div>
    </div>
  );
}
