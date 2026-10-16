import { keyboardMap } from '@/keyboard/keyboardMap';
import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

/**
 * The key P ("Parar", keyboardMap.stopRunningMacro): sends stopMacro for the macro the
 * server lists as running, whichever tab of the strip is shown, and nothing when none
 * runs. The quick-fire strip calls it, because the strip is always on the page while
 * the Macros tab is not.
 * What could go wrong: a page that missed the end of a run sends stopMacro for a run
 * that is over; the server answers ok and leaves no trace, so nothing is shown.
 */
export function useStopRunningMacroKey(): void {
  const macroRuns = useServerState((state) => state.macroRuns);
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();

  function stopTheRunningMacro(): void {
    const runningMacro = macroRuns[0];
    if (runningMacro === undefined) {
      return;
    }
    void sendCommand({ type: 'stopMacro', macroId: runningMacro.macroId });
  }

  useKeyboardShortcut(keyboardMap.stopRunningMacro, stopTheRunningMacro, {
    isEnabled: isConnected,
  });
}
