import { chooseCommandForOperatorKey } from '@/keyboard/commandForOperatorKey';
import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

/**
 * Backspace throws away the most recent preview (`stopPreview`) while anything is on the
 * preview output; with nothing previewed it clears the clock layer on air (docs/00-concept.md
 * §7: Backspace = clear layer; in M0 the clock was the only layer the page could fill, so
 * it is the layer Backspace means, and it still is while the page has no notion of a
 * selected layer). Which of the two a press sends is decided in
 * src/keyboard/commandForOperatorKey.ts, with the other keys that depend on the preview.
 * Inside a text field Backspace keeps its usual job of erasing a character, and on a
 * dropdown or the switch it does nothing: the operator is editing the form there.
 */
export function useBackspaceToStopPreviewOrClearClockLayer(): void {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();
  const instances = useServerState((state) => state.instances);

  function sendWhatBackspaceMeans(): void {
    // Backspace needs no rundown: it reads only what is on the preview output.
    const command = chooseCommandForOperatorKey('backspace', undefined, instances);
    if (command === null) {
      return;
    }
    void sendCommand(command);
  }

  useKeyboardShortcut('Backspace', sendWhatBackspaceMeans, {
    isEnabled: isConnected,
    isIgnoredWhileTyping: true,
  });
}
