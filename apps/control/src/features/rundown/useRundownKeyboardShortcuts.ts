import type { CommandInput, Item, Rundown } from '@bajaovrlay/shared';

import { chooseCommandForOperatorKey } from '@/keyboard/commandForOperatorKey';
import { type KeyPress, useKeyboardShortcut } from '@/keyboard/useKeyboardShortcut';
import {
  useIsConnectedToServer,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { findItemIdAfterCursor } from './itemAfterCursor';
import { findItemIdBeforeCursor } from './itemBeforeCursor';

// KeyboardEvent.key for the space bar is one space character, not the word "Space".
const spaceKey = ' ';
const rightArrowKey = 'ArrowRight';
const leftArrowKey = 'ArrowLeft';

/**
 * The keys of the rundown. Space puts the next item on air: the preview itself when it
 * shows the item at the cursor (`takePreview`), the item at the cursor otherwise
 * (`takeNext`). Shift+Space shows the item at the cursor on the preview output
 * (`previewItem`). What each of the two sends is decided in one place,
 * src/keyboard/commandForOperatorKey.ts. A take is handed to `sendTakeByThisOperator`
 * (features/autoPreview/useTakeThenPreviewNextItem.ts: the take, then a preview of the new cursor item while
 * "Prévia automática" is on, which is what makes Space, Space the operator's loop).
 * The Right and Left arrows move the cursor one
 * item forward or back without putting anything on air; `moveCursorByHand` is what they
 * call with the item to go to (useMoveCursorByHand.ts: `moveCursor`, then a preview
 * while "Prévia automática" is on). `rundown` is the rundown on screen, or undefined
 * while the server has sent none; then every key is off.
 *
 * João's ruling (gate 2 of BAJAOVRLAY-13): Space is ALWAYS "take next", also when a
 * mouse click left the focus on a button. The key takes and the button is not pressed.
 * The keys are left alone only where the operator is plainly doing something else:
 * typing in a field, on a dropdown or on a switch of a generated form (there Space
 * opens, picks or flips), and while a rundown row is being dragged from the keyboard
 * (the drag uses the key first). What could go wrong: with the focus on any button of
 * the page, "Salvar item" included, Space no longer presses it; Enter still does.
 * Shift+Space is the same listener, so every one of these rules holds for it too.
 */
export function useRundownKeyboardShortcuts(
  rundown: Rundown | undefined,
  itemsOfRundownInOrder: Item[],
  moveCursorByHand: (itemId: string) => void,
  sendTakeByThisOperator: (takeCommand: CommandInput) => void,
): void {
  const sendCommand = useSendCommand();
  const isConnected = useIsConnectedToServer();
  const instances = useServerState((state) => state.instances);

  // Null means the key has nothing to send (Shift+Space with the cursor on nothing).
  // Plain Space is sent even when the cursor is empty: the server owns the cursor, so
  // the server is the one to say "there is no next item", and its pt-BR message is shown.
  function sendWhatSpaceMeans(keyPress: KeyPress): void {
    const operatorKey = keyPress.isShiftHeld ? 'shiftSpace' : 'space';
    const command = chooseCommandForOperatorKey(operatorKey, rundown, instances);
    if (command === null) {
      return;
    }
    // Shift+Space only looks; plain Space is a take, whichever of the two takes it is.
    if (operatorKey === 'shiftSpace') {
      void sendCommand(command);
      return;
    }
    sendTakeByThisOperator(command);
  }

  function moveCursorToNextItem(): void {
    if (rundown === undefined) {
      return;
    }
    const itemIdAfterCursor = findItemIdAfterCursor(itemsOfRundownInOrder, rundown.cursorItemId);
    if (itemIdAfterCursor === null) {
      return;
    }
    moveCursorByHand(itemIdAfterCursor);
  }

  function moveCursorToPreviousItem(): void {
    if (rundown === undefined) {
      return;
    }
    const itemIdBeforeCursor = findItemIdBeforeCursor(itemsOfRundownInOrder, rundown.cursorItemId);
    if (itemIdBeforeCursor === null) {
      return;
    }
    moveCursorByHand(itemIdBeforeCursor);
  }

  const shortcutOptions = {
    isEnabled: isConnected && rundown !== undefined,
    isIgnoredWhileTyping: true,
    isKeptFromTheBrowser: true,
  };
  useKeyboardShortcut(spaceKey, sendWhatSpaceMeans, shortcutOptions);
  useKeyboardShortcut(rightArrowKey, moveCursorToNextItem, shortcutOptions);
  useKeyboardShortcut(leftArrowKey, moveCursorToPreviousItem, shortcutOptions);
}
