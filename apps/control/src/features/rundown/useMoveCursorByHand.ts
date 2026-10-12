import { useSendCommand } from '@/state/ControlPageStateProvider';

/**
 * Returns the function the rundown calls when THIS operator moves the cursor by hand: the
 * Right or Left arrow, or a click on a row's label. It sends `moveCursor` and, while
 * "Prévia automática" is on, `previewItem` for the same item once the server has
 * accepted the move: the arrow shows the item on the preview output, and Space then
 * sends that very preview to air (src/keyboard/commandForOperatorKey.ts).
 * `rundownId` is undefined while the server has sent no rundown; then nothing is sent.
 *
 * Deliberate, and left for João to confirm: only a move made at this keyboard previews.
 * A cursor that moves for another reason (a take moved it on to the next item, or
 * another operator moved it) previews nothing here, because the page would then send a
 * command nobody at this keyboard asked for, and with two control pages open both would
 * send it. The price: after Space the cursor is on the next item and that item is NOT
 * previewed by itself. To see it the operator presses Shift+Space, its row's "Prévia" or
 * its label; the Right arrow would move PAST it. A Space without any of those takes the
 * item unseen, as before previews existed.
 *
 * The preview waits for the server's "ok" to the move, so a refused move is never
 * followed by a preview, and its refusal stays on screen instead of being wiped by a
 * preview that succeeded. What could go wrong: `isAutoPreviewOn` is the switch as it was
 * at the press, so switching it off in the instant before the server answers is too late.
 */
export function useMoveCursorByHand(
  rundownId: string | undefined,
  isAutoPreviewOn: boolean,
): (itemId: string) => void {
  const sendCommand = useSendCommand();

  async function moveCursorThenPreviewTheItem(itemId: string): Promise<void> {
    if (rundownId === undefined) {
      return;
    }
    const wasTheMoveAccepted = await sendCommand({ type: 'moveCursor', rundownId, itemId });
    if (!wasTheMoveAccepted || !isAutoPreviewOn) {
      return;
    }
    await sendCommand({ type: 'previewItem', itemId });
  }

  return (itemId) => void moveCursorThenPreviewTheItem(itemId);
}
