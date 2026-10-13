import type { CommandInput } from '@bajaovrlay/shared';

import { useReadServerStateNow, useSendCommand } from '@/state/ControlPageStateProvider';

import { findItemIdToPreviewAfterTake } from './itemToPreviewAfterTake';

/**
 * Returns the function the rundown calls to send a take THIS operator asked for: Space
 * (`takeNext` or `takePreview`) and a row's "Disparar" (`takeItem`). It sends the take
 * and, once the server has accepted it, previews the item the cursor moved on to while
 * "Prévia automática" is on (itemToPreviewAfterTake.ts decides). That preview makes the
 * next Space a `takePreview`, so Space, Space, Space airs the rundown with every item
 * seen first (João's ruling, gate 2 of BAJAOVRLAY-15).
 * `rundownId` is undefined while the server has sent no rundown; the take is then sent
 * and nothing is previewed.
 *
 * Why the page does this and not the server: the switch lives in this browser. Only the
 * page that sent the take previews, so two control pages never both send it, and a take
 * by another operator previews nothing here. The preview is sent with origin `auto`, so
 * the server first throws away any older automatic preview.
 *
 * The cursor is read from the store, not from what the panel last drew: the server sends
 * the changed slices BEFORE its "ok" to the command, so right after the "ok" the store
 * already holds the cursor as the take left it.
 * What could go wrong: if another operator moves the cursor between this take and its
 * "ok", the item previewed is the one THEY put the cursor on; it is still the item at
 * the cursor, which is what the next Space takes. `isAutoPreviewOn` is the switch as it
 * was at the press.
 */
export function useTakeThenPreviewNextItem(
  rundownId: string | undefined,
  isAutoPreviewOn: boolean,
): (takeCommand: CommandInput) => void {
  const sendCommand = useSendCommand();
  const readServerStateNow = useReadServerStateNow();

  // Null when the cursor is on nothing, and when there is no such rundown.
  function readCursorItemIdNow(): string | null {
    const rundownNow = readServerStateNow().rundowns.find(
      (candidate) => candidate.id === rundownId,
    );
    return rundownNow?.cursorItemId ?? null;
  }

  async function sendTakeThenPreviewTheNextItem(takeCommand: CommandInput): Promise<void> {
    const cursorItemIdBeforeTake = readCursorItemIdNow();
    const wasTheTakeAccepted = await sendCommand(takeCommand);
    if (!wasTheTakeAccepted) {
      return;
    }
    const itemIdToPreview = findItemIdToPreviewAfterTake({
      isAutoPreviewOn,
      cursorItemIdBeforeTake,
      cursorItemIdAfterTake: readCursorItemIdNow(),
    });
    if (itemIdToPreview === null) {
      return;
    }
    await sendCommand({ type: 'previewItem', itemId: itemIdToPreview, origin: 'auto' });
  }

  return (takeCommand) => void sendTakeThenPreviewTheNextItem(takeCommand);
}
