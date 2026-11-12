import type { TakeItemCommand, TakeNextCommand } from '@bajaovrlay/shared';

import {
  refuseTakeFromACursorThatMoved,
  refuseTakeWithEmptyCursor,
  refuseUnknownRundown,
} from '../rundownCommandRefusals.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeItem } from './takeItem.js';

/**
 * takeNext: takes the item a rundown's cursor is on (what the Space key sends). It is
 * a takeItem of that item and nothing more, so the instance, the cursor moving on and
 * the refusals are all takeItem's, a layer another console had just changed included
 * (BAJAOVRLAY-69: what the console saw on air goes to takeItem as it came). Refused if the
 * rundown does not exist, or if its cursor is on nothing: the server never guesses which
 * item the operator meant. Refused too when the page names the cursor item it saw and the
 * cursor is on another item now (RUNDOWN_CURSOR_MOVED, gate 2 of PR #64): another press moved
 * it, so what the page saw on air was about another item, maybe on another layer, and the
 * operator presses again on what the page now shows. Like "Próximo"'s fromStep, this also
 * refuses one operator's own second Space pressed before the page heard of the first.
 */
export function reduceTakeNext(
  slices: SlicesChangedByCommands,
  command: TakeNextCommand,
  context: ReducerContext,
): ReducerOutcome {
  const rundown = slices.rundowns.find((candidate) => candidate.id === command.rundownId);
  if (rundown === undefined) {
    return { status: 'refused', error: refuseUnknownRundown(command.rundownId) };
  }
  if (rundown.cursorItemId === null) {
    return { status: 'refused', error: refuseTakeWithEmptyCursor(rundown.name) };
  }
  const hasTheCursorMovedSinceThePageSawIt =
    command.cursorItemIdSeen !== undefined && command.cursorItemIdSeen !== rundown.cursorItemId;
  if (hasTheCursorMovedSinceThePageSawIt) {
    const cursorItemNow = slices.items.find((item) => item.id === rundown.cursorItemId);
    const cursorItemLabelNow = cursorItemNow?.label ?? rundown.cursorItemId;
    return {
      status: 'refused',
      error: refuseTakeFromACursorThatMoved(rundown.name, cursorItemLabelNow),
    };
  }
  const takeOfTheCursorItem: TakeItemCommand = { type: 'takeItem', itemId: rundown.cursorItemId };
  if (command.instanceIdSeenOnAir !== undefined) {
    takeOfTheCursorItem.instanceIdSeenOnAir = command.instanceIdSeenOnAir;
  }
  return reduceTakeItem(slices, takeOfTheCursorItem, context);
}
