import { ptBR } from '@/i18n/ptBR';

/**
 * The renderer page marked as a monitor. `monitor=1` makes that page connect without the
 * renderer role and never report an instance's status: only the program output (what OBS
 * loads, `/render/` with nothing after it) is the truth about what is on air. Without
 * the mark this frame would turn the layer badge to "No ar" with OBS switched off, and a
 * fault in this frame alone would turn it to "Falhou" while the stream is fine.
 */
const rendererPageAddressAsMonitor = '/render/?monitor=1';

/**
 * Shows the operator what OBS shows: the renderer page itself in a frame, drawing the
 * same state from its own connection to the server. The renderer draws at the stream's
 * 1920x1080, so the frame is that size and scaled to a quarter, which fits a 480x270 box.
 */
export function ProgramMonitor() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{ptBR.programMonitor.title}</h2>
      {/* The muted background stands in for the video: the renderer page is transparent. */}
      <div className="h-[270px] w-[480px] overflow-hidden rounded-md border bg-muted">
        {/* pointer-events-none: the monitor is for looking, clicks must not land in it. */}
        <iframe
          src={rendererPageAddressAsMonitor}
          title={ptBR.programMonitor.title}
          className="pointer-events-none h-[1080px] w-[1920px] origin-top-left scale-25 border-0"
        />
      </div>
    </section>
  );
}
