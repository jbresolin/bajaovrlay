import type { Item, Rundown } from '@bajaovrlay/shared';

import { useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import { useIsConnectedToServer, useSendCommand } from '@/state/ControlPageStateProvider';

import { findItemIdAfterCursor } from './itemAfterCursor';

// KeyboardEvent.key for the space bar is one space character, not the word "Space".
const spaceKey = ' ';
const rightArrowKey = 'ArrowRight';

/**
 * The two keys of the rundown (docs/00-concept.md §7): Space puts the item at the cursor
 * on air (`takeNext`), and the Right arrow moves the cursor one item forward without
 * putting anything on air (`moveCursor`). `rundown` is the rundown on screen, or
 * undefined while the server has sent none; then both keys are off.
 *
 * Both keys are left alone while the operator types in a field, and while the focus is
 * on a button: there the browser uses Space to press that button, and one press must not
 * do two things. What could go wrong: after CLICKING a row's button the focus stays on
 * it, so the next Space presses that button again instead of taking the next item; the
 * operator must click outside or press Tab first.
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

  const shortcutOptions = {
    isEnabled: isConnected && rundown !== undefined,
    isIgnoredWhileTyping: true,
    isIgnoredOnButtonsAndLinks: true,
    isKeptFromTheBrowser: true,
  };
  useKeyboardShortcut(spaceKey, takeItemAtCursor, shortcutOptions);
  useKeyboardShortcut(rightArrowKey, moveCursorToNextItem, shortcutOptions);
}
