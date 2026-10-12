import type { CommandInput, Instance, Rundown } from '@bajaovrlay/shared';

/** The three operator keys whose meaning depends on what is being previewed. */
export type OperatorKey = 'space' | 'shiftSpace' | 'backspace';

// The id of the layer the server seeds for clocks. It is a layer, not a graphic: whatever
// graphic sits on it is what Backspace takes off air when nothing is previewed.
const clockLayerId = 'clock';

/**
 * Says which command a press of Space, Shift+Space or Backspace sends, given the rundown
 * on screen (undefined while the server has sent none) and the server's instances. Null
 * means "send nothing". This is the whole rule for the three keys, in one place, and it
 * reads no state of its own; WHERE a key is listened to at all (not while typing, not
 * when held, ...) is useKeyboardShortcut.ts.
 *
 * - Space: when the preview output shows the item at the cursor, that preview goes on
 *   air (`takePreview`), so what airs is what was seen; otherwise `takeNext`, as before.
 * - Shift+Space: the item at the cursor is shown on the preview output (`previewItem`).
 * - Backspace: the most recent preview is thrown away (`stopPreview`); with nothing
 *   previewed it clears the clock layer on air (`clearLayer`), as before.
 */
export function chooseCommandForOperatorKey(
  operatorKey: OperatorKey,
  rundown: Rundown | undefined,
  instances: Instance[],
): CommandInput | null {
  switch (operatorKey) {
    case 'space':
      return chooseCommandForSpace(rundown, instances);
    case 'shiftSpace':
      return chooseCommandForShiftSpace(rundown);
    case 'backspace':
      return chooseCommandForBackspace(instances);
  }
}

/**
 * Space. "The preview shows the cursor item" means: an instance on the preview output
 * that the server made from that item (it carries the item's id). A preview of another
 * item, or one made by hand in "Edição rápida", is not it, and Space then fires the
 * planned item with `takeNext` and leaves that preview where it is.
 * With the cursor on nothing `takeNext` is still sent: the server owns the cursor and
 * explains in pt-BR that there is no next item.
 * What could go wrong: `takePreview` airs the data as it was previewed. An item edited
 * after its preview goes on air as it was seen, not as it is stored now, until it is
 * previewed again (Shift+Space, or its row's "Prévia").
 */
function chooseCommandForSpace(
  rundown: Rundown | undefined,
  instances: Instance[],
): CommandInput | null {
  if (rundown === undefined) {
    return null;
  }
  const cursorItemId = rundown.cursorItemId;
  const previewOfCursorItem =
    cursorItemId === null
      ? undefined
      : instances.find(
          (instance) => instance.target === 'preview' && instance.itemId === cursorItemId,
        );
  if (previewOfCursorItem === undefined) {
    return { type: 'takeNext', rundownId: rundown.id };
  }
  return { type: 'takePreview', layerId: previewOfCursorItem.layerId };
}

/**
 * Shift+Space. Unlike `takeNext`, `previewItem` names an item, so with the cursor on
 * nothing there is nothing to send and no refusal to show; the rundown panel already
 * tells the operator to place the cursor. A cursor on an item this page does not list is
 * still sent: the server knows better which items exist, and refuses in pt-BR if not.
 */
function chooseCommandForShiftSpace(rundown: Rundown | undefined): CommandInput | null {
  if (rundown === undefined || rundown.cursorItemId === null) {
    return null;
  }
  return { type: 'previewItem', itemId: rundown.cursorItemId };
}

/**
 * Backspace. With previews on several layers one press throws away one: the preview made
 * most recently (the later one in the list when two were made at the same moment), which
 * is the one the operator has just looked at. Deliberate: not all of them at once
 * (`layerId: null`), because the brief says "the previewed layer" and a key should undo
 * one step, not several.
 * What could go wrong: once no preview is left, the next Backspace is the old one and
 * takes the clock layer OFF AIR. An operator who presses Backspace once more than there
 * are previews clears the clock.
 */
function chooseCommandForBackspace(instances: Instance[]): CommandInput {
  let mostRecentPreview: Instance | undefined = undefined;
  for (const instance of instances) {
    if (instance.target !== 'preview') {
      continue;
    }
    const isMadeNoEarlierThanTheOneFound =
      mostRecentPreview === undefined ||
      Date.parse(instance.takenAt) >= Date.parse(mostRecentPreview.takenAt);
    if (isMadeNoEarlierThanTheOneFound) {
      mostRecentPreview = instance;
    }
  }
  if (mostRecentPreview === undefined) {
    return { type: 'clearLayer', layerId: clockLayerId };
  }
  return { type: 'stopPreview', layerId: mostRecentPreview.layerId };
}
