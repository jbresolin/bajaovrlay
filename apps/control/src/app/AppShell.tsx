import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { TakeRaceClockPanel } from '@/features/playout/TakeRaceClockPanel';
import { useBackspaceToClearClockLayer } from '@/features/playout/useBackspaceToClearClockLayer';
import { ProgramMonitor } from '@/features/programMonitor/ProgramMonitor';
import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

/**
 * The frame of the control page (docs/00-concept.md §3.4): a header and three areas
 * that are always on screen on a desktop — rundown on the left, program monitor and
 * take panel in the centre, layer status and clear all on the right. Layout only; each
 * area's behaviour lives in its feature folder.
 */
export function AppShell() {
  useBackspaceToClearClockLayer();

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{ptBR.app.title}</h1>
        <div className="flex items-center gap-4">
          <ServerHealthCheck />
          <ConnectionBadge />
        </div>
      </header>

      <main className="grid flex-1 grid-cols-[16rem_minmax(0,1fr)_22rem] items-start gap-4">
        <section aria-label={ptBR.app.rundownAreaTitle} className="flex flex-col gap-3">
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {ptBR.app.rundownPlaceholder}
          </p>
        </section>

        <section aria-label={ptBR.app.playoutAreaTitle} className="flex flex-col gap-4">
          <ProgramMonitor />
          <TakeRaceClockPanel />
        </section>

        <section aria-label={ptBR.app.layersAreaTitle} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{ptBR.app.layersAreaTitle}</h2>
          <LayerStatusPanel />
          <ClearAllButton />
          <CommandErrorMessage commandTypes={['clearLayer', 'clearAll']} />
        </section>
      </main>
    </div>
  );
}
