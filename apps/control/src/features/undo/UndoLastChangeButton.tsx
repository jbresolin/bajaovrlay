import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionButton } from '@/features/connection/ActionButton';
import { listLayersInCamadasOrder } from '@/features/layers/layersInCamadasOrder';
import { ptBR } from '@/i18n/ptBR';
import { keyboardMap } from '@/keyboard/keyboardMap';
import { type KeyPress, useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { describeWhatUndoLastChangeBringsBack } from './whatUndoBringsBack';

/**
 * "Desfazer última" (BAJAOVRLAY-30): undoes the newest change on program, every layer it
 * touched at once (a "Limpar tudo" comes back whole). It sits beside "Limpar tudo" and is
 * always on screen: off, saying why, when nothing is remembered; otherwise its tooltip
 * names each layer and what comes back. Ctrl+Z is the same button
 * (src/keyboard/keyboardMap.ts, undoLastChange), left to a text field while typing in one.
 * Deliberate: Ctrl+Shift+Z sends nothing. Many programs read it as "redo", and there is no
 * redo here; an undo sent for it would be the opposite of what was meant.
 */
export function UndoLastChangeButton() {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();
  const programHistory = useServerState((state) => state.programHistory);
  const layers = useServerState((state) => state.layers);
  const outputs = useServerState((state) => state.outputs);
  const whatComesBack = describeWhatUndoLastChangeBringsBack(
    programHistory,
    listLayersInCamadasOrder(layers, outputs),
  );
  const isAnythingToUndo = whatComesBack !== undefined;

  function sendTheUndo(): void {
    void sendCommand({ type: 'undoLastChangeOnProgram' });
  }

  function handleKeyPress(keyPress: KeyPress): void {
    if (keyPress.isShiftHeld || !isAnythingToUndo) {
      return;
    }
    sendTheUndo();
  }

  useKeyboardShortcut(keyboardMap.undoLastChange, handleKeyPress, { isEnabled: isConnected });

  if (!isConnected || !isAnythingToUndo) {
    return (
      <ActionButton variant="outline" disabledReason={ptBR.undo.nothingToUndo}>
        {ptBR.undo.undoLastChangeButton}
      </ActionButton>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={sendTheUndo}>
          {ptBR.undo.undoLastChangeButton}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{whatComesBack}</TooltipContent>
    </Tooltip>
  );
}
