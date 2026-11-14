import type { CommandInput } from '@bajaovrlay/shared';

import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';
import type { AreaOfThePage } from '@/state/commandFailure';
import { useReadServerStateNow, useSendCommand } from '@/state/ControlPageStateProvider';

import { useAutoPreviewSetting } from './AutoPreviewSettingProvider';
import { findItemIdToPreviewAfterTake } from './itemToPreviewAfterTake';

/**
 * Returns the function the page calls to send a take THIS operator asked for: Space
 * (`takeNext` or `takePreview`) and a row's "Disparar" (`takeItem`) in the rundown
 * column, and "Tomar" under the "Prévia" monitor (`takePreview`). It sends the take and,
 * once the server has accepted it, previews the item the cursor of the rundown shown on
 * the page moved on to, while "Prévia automática" is on (itemToPreviewAfterTake.ts
 * decides). That preview makes the next Space a `takePreview`, so Space, Space, Space airs
 * the rundown with every item seen first (João's ruling, gate 2 of BAJAOVRLAY-15), and
 * "Tomar", "Tomar" does the same with the mouse (BAJAOVRLAY-16).
 *
 * Why the page does this and not the server: the switch lives in this browser. Only the
 * page that sent the take previews, so two control pages never both send it, and a take
 * by another operator previews nothing here. The preview is sent with origin `auto`, so
 * the server first throws away any older automatic preview.
 *
 * The rundown and its cursor are read from the store, not from what a component last
 * drew: the server sends the changed slices BEFORE its "ok" to the command, so right after
 * the "ok" the store already holds the cursor as the take left it. The rundown is chosen
 * at the press by the page's one rule (rundownShownOnPage.ts), so "Tomar", which draws no
 * rundown, needs no rundown id handed to it. With no rundown the take is still sent and
 * nothing is previewed.
 * What could go wrong: if another operator moves the cursor between this take and its
 * "ok", the item previewed is the one THEY put the cursor on; it is still the item at
 * the cursor, which is what the next Space takes. The switch counts as it was at the press.
 * `areaOfThePage` names the part of the page the takes come from (the rundown column, the
 * quick-fire strip), so a refused take is shown there only, once (BAJAOVRLAY-69). What the
 * page showed on air is added to every take by the connection (state/whatThisPageSawOnAir.ts).
 */
export function useTakeThenPreviewNextItem(
  areaOfThePage?: AreaOfThePage,
): (takeCommand: CommandInput) => void {
  const sendCommand = useSendCommand();
  const readServerStateNow = useReadServerStateNow();
  const { isAutoPreviewOn } = useAutoPreviewSetting();

  // Null when the cursor is on nothing, and when there is no such rundown.
  function readCursorItemIdNow(rundownId: string | undefined): string | null {
    const rundownNow = readServerStateNow().rundowns.find(
      (candidate) => candidate.id === rundownId,
    );
    return rundownNow?.cursorItemId ?? null;
  }

  async function sendTakeThenPreviewTheNextItem(takeCommand: CommandInput): Promise<void> {
    const rundownIdAtThePress = findRundownShownOnPage(readServerStateNow().rundowns)?.id;
    const cursorItemIdBeforeTake = readCursorItemIdNow(rundownIdAtThePress);
    const wasTheTakeAccepted = await sendCommand(takeCommand, areaOfThePage);
    if (!wasTheTakeAccepted) {
      return;
    }
    const itemIdToPreview = findItemIdToPreviewAfterTake({
      isAutoPreviewOn,
      cursorItemIdBeforeTake,
      cursorItemIdAfterTake: readCursorItemIdNow(rundownIdAtThePress),
    });
    if (itemIdToPreview === null) {
      return;
    }
    await sendCommand({ type: 'previewItem', itemId: itemIdToPreview, origin: 'auto' });
  }

  return (takeCommand) => void sendTakeThenPreviewTheNextItem(takeCommand);
}
