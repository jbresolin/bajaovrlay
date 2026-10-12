import { ConnectionBadge } from '@/features/connection/ConnectionBadge';
import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { PreviewAndProgramMonitors } from '@/features/outputMonitors/PreviewAndProgramMonitors';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { QuickEditPanel } from '@/features/playout/QuickEditPanel';
import { useBackspaceToStopPreviewOrClearClockLayer } from '@/features/playout/useBackspaceToStopPreviewOrClearClockLayer';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { ServerHealthCheck } from '@/features/serverHealth/ServerHealthCheck';
import { ptBR } from '@/i18n/ptBR';

/**
 * The frame of the control page (docs/00-concept.md §3.4): a header and three areas
 * that are always on screen on a desktop — rundown on the left; in the centre the two
 * monitors side by side ("Prévia" with what is previewed and its "Tomar"/"Descartar",
 * then "Programa") above "Edição rápida" (the take, preview and update panel for any
 * graphic); layer status and clear all on the right. Layout only; each area's behaviour
 * lives in its feature folder, and nothing here knows any graphic by name.
 * The left column is 20rem wide: a rundown row holds a label, the graphic, the layer and
 * four buttons, and the item editor opens in the same column. The centre column takes
 * what is left: on a 1920 px wide screen that fits both 480 px monitors side by side; on
 * a narrower one "Programa" wraps under "Prévia" (PreviewAndProgramMonitors.tsx).
 */
export function AppShell() {
  useBackspaceToStopPreviewOrClearClockLayer();

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
          <PreviewAndProgramMonitors />
          <QuickEditPanel />
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
