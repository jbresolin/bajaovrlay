import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { PreviewAndProgramMonitors } from '@/features/outputMonitors/PreviewAndProgramMonitors';
import { useBackspaceToStopPreview } from '@/features/outputMonitors/useBackspaceToStopPreview';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { QuickEditPanel } from '@/features/playout/QuickEditPanel';
import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { UndoLastChangeButton } from '@/features/undo/UndoLastChangeButton';
import { ptBR } from '@/i18n/ptBR';

/**
 * The console: the three areas that are always on screen on a desktop
 * (docs/00-concept.md §3.4) — rundown on the left; in the centre the two monitors stacked
 * ("Prévia" with what is previewed and its "Tomar"/"Descartar", then "Programa") above
 * "Edição rápida" (the take, preview and update panel for any graphic); on the right the
 * quick-fire strip (a tab per panel of buttons, "Macros" and "Eventos") above the layer
 * status, clear all and "Desfazer última" (Ctrl+Z, BAJAOVRLAY-30). Layout only; each
 * area's behaviour lives in its feature folder, and nothing here knows any graphic by name.
 *
 * The columns (BAJAOVRLAY-59): the right column, where the operator works most, takes
 * what is left and is the widest at every size; the other two are fixed per window width.
 * - The rundown is 21rem (336 px; 320 px before): a row holds a label, the graphic, the
 *   layer and four buttons, and at 320 px "Excluir" fell onto a line of its own. The
 *   page's one item editor opens in the same column.
 * - The centre is 40rem (640 px) from a 1800 px wide window up. On the 1920x1080 target
 *   that makes each stacked monitor 640x360, a third of the stream, and the bottom of
 *   "Programa" lands about 910 px down: under a browser's own bars the page has about
 *   950 px, so both monitors are seen whole without scrolling. Wider would push
 *   "Programa" off a real browser window; the right column is then 880 px.
 * - 34rem (544 px) from 1600 px up, 28rem (448 px) from 1344 px up, and 18rem (288 px,
 *   what it had at 1024 px before) below. Each step keeps the right column wider than the
 *   centre (656 px at 1600, 518 px at 1366, 336 px at 1024) and both monitors on screen
 *   (at 1366x768 they end about 700 px down). The steps sit a little below the screens
 *   they are for (1366, 1600, 1920), so a window a few pixels short still gets them.
 * The right column is `minmax(0, 1fr)`: whatever is inside it, it never pushes the page
 * wider than the window, so the console only ever scrolls down, never sideways.
 *
 * Backspace, which discards a preview, is listened to here because the key belongs to
 * the whole console and not to one area; the strip's keys (1–9, F1–F4) live in the
 * strip, which holds the tab they depend on. Every console key lives inside this view,
 * so none of them fires on the "Fontes" page (decision D16 of BAJAOVRLAY-17).
 */
export function ConsoleView() {
  useBackspaceToStopPreview();

  return (
    <main className="grid flex-1 grid-cols-[21rem_18rem_minmax(0,1fr)] items-start gap-4 min-[84rem]:grid-cols-[21rem_28rem_minmax(0,1fr)] min-[100rem]:grid-cols-[21rem_34rem_minmax(0,1fr)] min-[112.5rem]:grid-cols-[21rem_40rem_minmax(0,1fr)]">
      <section aria-label={ptBR.app.rundownAreaTitle} className="flex min-w-0 flex-col gap-3">
        <RundownPanel />
      </section>

      <section aria-label={ptBR.app.playoutAreaTitle} className="flex min-w-0 flex-col gap-4">
        <PreviewAndProgramMonitors />
        <QuickEditPanel />
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <QuickFireStrip />
        <section aria-label={ptBR.app.layersAreaTitle} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{ptBR.app.layersAreaTitle}</h2>
          <LayerStatusPanel />
          {/* "Desfazer última" beside "Limpar tudo", both always on screen (§7 rule 5). */}
          <div className="flex flex-wrap gap-2">
            <ClearAllButton />
            <UndoLastChangeButton />
          </div>
          <CommandErrorMessage
            commandTypes={['clearLayer', 'clearAll', 'undoLastChangeOnProgram']}
          />
        </section>
      </div>
    </main>
  );
}
