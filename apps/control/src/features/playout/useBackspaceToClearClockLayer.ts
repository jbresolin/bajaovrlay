import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

// The id of the layer the server seeds for clocks. It is a layer, not a graphic: whatever
// graphic sits on it is what Backspace takes off air.
const clockLayerId = 'clock';

/**
 * Backspace clears the clock layer (docs/00-concept.md §7: Backspace = clear layer; in
 * M0 the clock was the only layer the page could fill, so it is the layer Backspace
 * means, and it still is while the page has no notion of a selected layer).
 * Inside a text field Backspace keeps its usual job of erasing a character, and on a
 * dropdown or the switch it does nothing: the operator is editing the form there.
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
