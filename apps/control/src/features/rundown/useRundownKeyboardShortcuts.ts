import type { Item, Rundown } from '@bajaovrlay/shared';

import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

import { findItemIdAfterCursor } from './itemAfterCursor';
import { findItemIdBeforeCursor } from './itemBeforeCursor';

// KeyboardEvent.key for the space bar is one space character, not the word "Space".
const spaceKey = ' ';
const rightArrowKey = 'ArrowRight';
const leftArrowKey = 'ArrowLeft';

/**
 * The three keys of the rundown: Space puts the item at the cursor on air (`takeNext`),
 * and the Right and Left arrows move the cursor one item forward or back without putting
 * anything on air (`moveCursor`). `rundown` is the rundown on screen, or undefined while
 * the server has sent none; then all three keys are off.
 *
 * João's ruling (gate 2 of BAJAOVRLAY-13): Space is ALWAYS "take next", also when a
 * mouse click left the focus on a button. The key takes and the button is not pressed.
 * The keys are left alone only where the operator is plainly doing something else:
 * typing in a field, on a dropdown or on the "Relógio correndo" switch (there Space
 * opens, picks or flips), and while a rundown row is being dragged from the keyboard
 * (the drag uses the key first). What could go wrong: with the focus on any button of
 * the page, "Salvar item" included, Space no longer presses it; Enter still does.
 */
export function useRundownKeyboardShortcuts(
  rundown: Rundown | undefined,
  itemsOfRundownInOrder: Item[],
): void {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();

  // Sent even when the cursor is empty: the server owns the cursor, so the server is the
  // one to say "there is no next item", and its pt-BR message is shown in the panel.
  function takeItemAtCursor(): void {
    if (rundown === undefined) {
      return;
    }
    void sendCommand({ type: 'takeNext', rundownId: rundown.id });
  }

  function moveCursorToNextItem(): void {
    if (rundown === undefined) {
      return;
    }
    const itemIdAfterCursor = findItemIdAfterCursor(itemsOfRundownInOrder, rundown.cursorItemId);
    if (itemIdAfterCursor === null) {
      return;
    }
    void sendCommand({ type: 'moveCursor', rundownId: rundown.id, itemId: itemIdAfterCursor });
  }

  function moveCursorToPreviousItem(): void {
    if (rundown === undefined) {
      return;
    }
    const itemIdBeforeCursor = findItemIdBeforeCursor(itemsOfRundownInOrder, rundown.cursorItemId);
    if (itemIdBeforeCursor === null) {
      return;
    }
    void sendCommand({ type: 'moveCursor', rundownId: rundown.id, itemId: itemIdBeforeCursor });
  }

  const shortcutOptions = {
    isEnabled: isConnected && rundown !== undefined,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
  };
  useKeyboardShortcut(spaceKey, takeItemAtCursor, shortcutOptions);
  useKeyboardShortcut(rightArrowKey, moveCursorToNextItem, shortcutOptions);
  useKeyboardShortcut(leftArrowKey, moveCursorToPreviousItem, shortcutOptions);
}
