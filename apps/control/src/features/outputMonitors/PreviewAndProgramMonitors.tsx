import { OutputMonitor } from './OutputMonitor';
import { PreviewedLayersList } from './PreviewedLayersList';

/**
 * The two monitors of the centre column, side by side: "Prévia" on the left, with the
 * lines of what is previewed under it, and "Programa" on the right. It reads left to
 * right as the show runs: look at it first, then it is on air.
 *
 * Each monitor is 480 px wide, so the pair needs 976 px. The centre column has that on a
 * 1920 px wide screen (1184 px are left between the two side columns) but not on a
 * 1600 px one (864 px). Deliberate: when the pair does not fit, "Programa" wraps under
 * "Prévia" and both keep their size, instead of being scaled down. A 480x270 box is
 * exactly a quarter of the stream's 1920x1080, which keeps thin lines and small text of a
 * graphic readable; the price on a narrow screen is that "Edição rápida" starts lower.
 */
export function PreviewAndProgramMonitors() {
  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* As wide as the monitor, so a long label is cut short instead of pushing
          "Programa" to the next row. */}
      <div className="flex w-[480px] flex-col gap-2">
        <OutputMonitor output="preview" />
        <PreviewedLayersList />
      </div>
      <OutputMonitor output="program" />
    </div>
  );
}
