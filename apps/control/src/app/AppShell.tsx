import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { TakeRaceClockPanel } from '@/features/playout/TakeRaceClockPanel';
import { useBackspaceToClearClockLayer } from '@/features/playout/useBackspaceToClearClockLayer';
import { ProgramMonitor } from '@/features/programMonitor/ProgramMonitor';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

/**
 * The frame of the control page (docs/00-concept.md §3.4): a header and three areas
 * that are always on screen on a desktop — rundown on the left, program monitor and
 * take panel in the centre, layer status and clear all on the right. Layout only; each
 * area's behaviour lives in its feature folder.
 * The left column is 20rem wide: a rundown row holds a label, the graphic, the layer and
 * three buttons, and the item editor opens in the same column.
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

      <main className="grid flex-1 grid-cols-[20rem_minmax(0,1fr)_22rem] items-start gap-4">
        <section aria-label={ptBR.app.rundownAreaTitle} className="flex flex-col gap-3">
          <RundownPanel />
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
