import { useEffect, useState } from 'react';

import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { keyboardMap } from '@/keyboard/keyboardMap';
import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

/** How long the button waits for the second press before going back to normal. */
export const clearAllConfirmationWindowInMilliseconds = 3_000;

/**
 * The panic button: takes every graphic off every layer. One stray click must not blank
 * the stream, so the first press only arms it and a second press within 3 seconds sends
 * `clearAll`. The Esc key is the same button: either can arm, either can confirm.
 * No browser `confirm()`: a dialog would freeze the page in the middle of a show.
 */
export function ClearAllButton() {
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();

  // While armed, a timer disarms the button after 3 seconds. Pressing again (which
  // disarms it too) or leaving the page cancels the timer.
  useEffect(() => {
    if (!isAwaitingConfirmation) {
      return;
    }
    const disarmTimer = setTimeout(() => {
      setIsAwaitingConfirmation(false);
    }, clearAllConfirmationWindowInMilliseconds);
    return () => {
      clearTimeout(disarmTimer);
    };
  }, [isAwaitingConfirmation]);

  function handlePress(): void {
    if (!isAwaitingConfirmation) {
      setIsAwaitingConfirmation(true);
      return;
    }
    setIsAwaitingConfirmation(false);
    void sendCommand({ type: 'clearAll' });
  }

  // Esc works from anywhere, even while typing in a field: it is the panic key
  // (src/keyboard/keyboardMap.ts, clearAll). An Esc that closes a dropdown, a menu or a
  // dialog is used by that control first, and so neither arms nor confirms.
  useKeyboardShortcut(keyboardMap.clearAll, handlePress, { isEnabled: isConnected });

  return (
    <ActionButton variant="destructive" onClick={handlePress}>
      {isAwaitingConfirmation ? ptBR.playout.clearAllConfirmButton : ptBR.playout.clearAllButton}
    </ActionButton>
  );
}
