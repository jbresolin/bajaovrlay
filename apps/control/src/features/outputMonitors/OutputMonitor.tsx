import { ptBR } from '@/i18n/ptBR';

/** The two outputs a monitor can frame: what is on air, and what is being looked at first. */
export type MonitoredOutput = 'program' | 'preview';

/**
 * The renderer page each monitor frames. `monitor=1` makes that page connect without the
 * renderer role and never report an instance's status: only the program output (what OBS
 * loads, `/render/` with nothing after it) is the truth about what is on air. Without
 * the mark the "Programa" frame would turn the layer badge to "No ar" with OBS switched
 * off, and a fault in that frame alone would turn it to "Falhou" while the stream is
 * fine. `target=preview` makes the page draw the preview output instead of the program
 * output. What could go wrong: the renderer page only understands these exact words, so
 * a typo here silently gives a page that draws the program output, or reports like OBS.
 */
const rendererPageAddressOfOutput: Record<MonitoredOutput, string> = {
  program: '/render/?monitor=1',
  preview: '/render/?target=preview&monitor=1',
};

const titleOfOutput: Record<MonitoredOutput, string> = {
  program: ptBR.outputMonitors.programTitle,
  preview: ptBR.outputMonitors.previewTitle,
};

/**
 * Shows the operator one output: the renderer page itself in a frame, drawing the same
 * state from its own connection to the server, so "Prévia" and "Programa" are the very
 * pixels OBS shows. The renderer draws at the stream's 1920x1080, so the frame is that
 * size and scaled to a quarter, which fits a 480x270 box.
 */
export function OutputMonitor(props: { output: MonitoredOutput }) {
  const title = titleOfOutput[props.output];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {/* The muted background stands in for the video: the renderer page is transparent. */}
      <div className="h-[270px] w-[480px] overflow-hidden rounded-md border bg-muted">
        {/* pointer-events-none: the monitor is for looking, clicks must not land in it. */}
        <iframe
          src={rendererPageAddressOfOutput[props.output]}
          title={title}
          className="pointer-events-none h-[1080px] w-[1920px] origin-top-left scale-25 border-0"
        />
      </div>
    </section>
  );
}
