import { useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { keyboardMap } from '@/keyboard/keyboardMap';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { MacroButton } from './MacroButton';
import { MacroEditorPanel } from './MacroEditorPanel';

/** What the macro editor is open for: nothing, a new macro, or a stored one. */
type MacroEditorTarget =
  { kind: 'closed' } | { kind: 'newMacro' } | { kind: 'existingMacro'; macroId: string };

const texts = ptBR.quickFire.macros;

/**
 * The "Macros" tab of the quick-fire strip: "+ Macro", the macro editor while it is open,
 * and a grid of macro buttons in the order the server lists them (the order they were
 * made, which is also the order of the digits 1–9 on this tab). A click sends `runMacro`;
 * the server's runner does the rest and reports progress in the `macroRuns` slice, which
 * each button reads to show it is running; the running macro's "Parar" sends `stopMacro`.
 * A button's "⋯" menu has "Executar" (`runMacro` again), "Prévia" (`previewMacro`: the
 * macro's end state on the preview output, which "Tomar tudo" applies without the
 * waits) and "Editar". Refusals of all of these are shown by the strip (QuickFireStrip).
 */
export function MacroGrid() {
  const macros = useServerState((state) => state.macros);
  const macroRuns = useServerState((state) => state.macroRuns);
  const macroStops = useServerState((state) => state.macroStops);
  const sendCommand = useSendCommand();
  const [macroEditorTarget, setMacroEditorTarget] = useState<MacroEditorTarget>({
    kind: 'closed',
  });

  // Looked up on every draw, like the item editor's item: a macro deleted by someone else
  // while it is open takes the editor off the screen instead of saving to nothing.
  const macroBeingEdited =
    macroEditorTarget.kind === 'existingMacro'
      ? macros.find((macro) => macro.id === macroEditorTarget.macroId)
      : undefined;
  const isEditorOnScreen = macroEditorTarget.kind === 'newMacro' || macroBeingEdited !== undefined;
  const digitKeys = keyboardMap.fireQuickFireButton.keys;

  function closeMacroEditor(): void {
    setMacroEditorTarget({ kind: 'closed' });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <ActionButton
          size="xs"
          variant="outline"
          onClick={() => setMacroEditorTarget({ kind: 'newMacro' })}
        >
          {texts.addMacroButton}
        </ActionButton>
      </div>

      {/* The key gives each macro, and a new one, a fresh editor. */}
      {isEditorOnScreen ? (
        <MacroEditorPanel
          key={macroBeingEdited?.id ?? 'new-macro'}
          macroBeingEdited={macroBeingEdited ?? null}
          onClose={closeMacroEditor}
        />
      ) : null}

      {macros.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {texts.emptyMacros}
        </p>
      ) : (
        // As many 10rem buttons per row as the column holds, like the shortcuts
        // (QuickFirePanelView.tsx), so both tabs line up the same.
        <ul
          aria-label={texts.gridLabel}
          className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2"
        >
          {macros.map((macro, position) => (
            <MacroButton
              key={macro.id}
              macro={macro}
              runOfThisMacro={macroRuns.find((run) => run.macroId === macro.id)}
              stopOfThisMacro={macroStops.find((macroStop) => macroStop.macroId === macro.id)}
              digitKey={digitKeys[position] ?? null}
              onRunPressed={() => void sendCommand({ type: 'runMacro', macroId: macro.id })}
              onPreviewChosen={() => void sendCommand({ type: 'previewMacro', macroId: macro.id })}
              onEditChosen={() =>
                setMacroEditorTarget({ kind: 'existingMacro', macroId: macro.id })
              }
              onStopPressed={() => void sendCommand({ type: 'stopMacro', macroId: macro.id })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
