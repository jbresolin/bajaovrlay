import { chooseCommandForOperatorKey } from '@/keyboard/commandForOperatorKey';
import { keyboardMap } from '@/keyboard/keyboardMap';
import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

/**
 * Backspace throws away the most recent preview (`stopPreview`): the keyboard twin of
 * "Descartar" under the "Prévia" monitor, which is why it lives in this folder. With
 * nothing on the preview output it sends nothing at all. Which preview a press discards
 * is decided in src/keyboard/commandForOperatorKey.ts, with the other keys that depend on
 * the preview.
 *
 * João's ruling (gate 2 of BAJAOVRLAY-15): Backspace never clears the clock layer. Until
 * then it did when nothing was previewed, so one press too many took the clock off air.
 * A layer on air is cleared with its row's "Limpar" button.
 *
 * Inside a text field Backspace keeps its usual job of erasing a character, and on a
 * dropdown or a switch it does nothing: the operator is editing the form there.
 */
export function useBackspaceToStopPreview(): void {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();
  const instances = useServerState((state) => state.instances);

  function discardTheMostRecentPreview(): void {
    // Backspace needs no rundown: it reads only what is on the preview output.
    const command = chooseCommandForOperatorKey('backspace', undefined, instances);
    if (command === null) {
      return;
    }
    void sendCommand(command);
  }

  // The key and where it is left alone are in src/keyboard/keyboardMap.ts.
  useKeyboardShortcut(keyboardMap.discardPreview, discardTheMostRecentPreview, {
    isEnabled: isConnected,
  });
}
