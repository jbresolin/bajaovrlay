import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

import { clockLayerId } from './raceClockTakeForm';

/**
 * Backspace clears the clock layer (docs/00-concept.md §7: Backspace = clear layer; in
 * M0 the clock is the only layer the page can fill, so it is the layer Backspace means).
 * Inside a text field Backspace keeps its usual job of erasing a character.
 */
export function useBackspaceToClearClockLayer(): void {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();

  function clearClockLayer(): void {
    void sendCommand({ type: 'clearLayer', layerId: clockLayerId });
  }

  useKeyboardShortcut('Backspace', clearClockLayer, {
    isEnabled: isConnected,
    isIgnoredWhileTyping: true,
  });
}
