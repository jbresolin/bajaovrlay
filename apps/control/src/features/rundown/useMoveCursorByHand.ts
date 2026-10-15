import { useAutoPreviewSetting } from '@/features/autoPreview/AutoPreviewSettingProvider';
import { useSendCommand } from '@/state/ControlPageStateProvider';

/**
 * Returns the function the rundown calls when THIS operator moves the cursor by hand: the
 * Right or Left arrow, or a click on a row's label. It sends `moveCursor` and, while
 * "Prévia automática" is on, `previewItem` for the same item once the server has
 * accepted the move: the arrow shows the item on the preview output, and Space then
 * sends that very preview to air (src/keyboard/commandForOperatorKey.ts).
 * `rundownId` is undefined while the server has sent no rundown; then nothing is sent.
 *
 * The preview is sent with origin `auto`: the server first throws away every other
 * preview that was itself automatic, so arrowing past items on different layers leaves
 * only the item at the cursor in preview. Previews the operator asked for by hand stay.
 *
 * Only this page's own actions preview: a move made at this keyboard (here) and a take
 * sent from this page (features/autoPreview/useTakeThenPreviewNextItem.ts). The switch is
 * read from the page's one store (features/autoPreview/). A cursor moved by another operator
 * previews nothing here, because the page would then send a command nobody at this
 * keyboard caused, and with two control pages open both would send it.
 *
 * The preview waits for the server's "ok" to the move, so a refused move is never
 * followed by a preview, and its refusal stays on screen instead of being wiped by a
 * preview that succeeded. What could go wrong: the switch counts as it was at the press,
 * so switching it off in the instant before the server answers is too late.
 */
export function useMoveCursorByHand(rundownId: string | undefined): (itemId: string) => void {
  const sendCommand = useSendCommand();
  const { isAutoPreviewOn } = useAutoPreviewSetting();

  async function moveCursorThenPreviewTheItem(itemId: string): Promise<void> {
    if (rundownId === undefined) {
      return;
    }
    const wasTheMoveAccepted = await sendCommand({ type: 'moveCursor', rundownId, itemId });
    if (!wasTheMoveAccepted || !isAutoPreviewOn) {
      return;
    }
    await sendCommand({ type: 'previewItem', itemId, origin: 'auto' });
  }

  return (itemId) => void moveCursorThenPreviewTheItem(itemId);
}
