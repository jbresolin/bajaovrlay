import { ptBR } from '@/i18n/ptBR';

/**
 * Shows the operator exactly what OBS shows: the renderer page itself (`/render/`, the
 * address OBS loads) in a frame. The renderer draws at the stream's 1920x1080, so the
 * frame is that size and scaled to a quarter, which fits a 480x270 box. Just the frame,
 * no logic: the renderer inside it has its own connection to the server.
 */
export function ProgramMonitor() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{ptBR.programMonitor.title}</h2>
      {/* The muted background stands in for the video: the renderer page is transparent. */}
      <div className="h-[270px] w-[480px] overflow-hidden rounded-md border bg-muted">
        {/* pointer-events-none: the monitor is for looking, clicks must not land in it. */}
        <iframe
          src="/render/"
          title={ptBR.programMonitor.title}
          className="pointer-events-none h-[1080px] w-[1920px] origin-top-left scale-25 border-0"
        />
      </div>
    </section>
  );
}
