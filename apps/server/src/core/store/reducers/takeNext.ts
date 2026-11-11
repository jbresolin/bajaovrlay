import type { TakeItemCommand, TakeNextCommand } from '@bajaovrlay/shared';

import { refuseTakeWithEmptyCursor, refuseUnknownRundown } from '../rundownCommandRefusals.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeItem } from './takeItem.js';

/**
 * takeNext: takes the item a rundown's cursor is on (what the Space key sends). It is
 * a takeItem of that item and nothing more, so the instance, the cursor moving on and
 * the refusals are all takeItem's, a layer another console had just changed included
 * (BAJAOVRLAY-69: what the console saw on air goes to takeItem as it came). Refused if the
 * rundown does not exist, or if its cursor is on nothing: the server never guesses which
 * item the operator meant.
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
  const takeOfTheCursorItem: TakeItemCommand = { type: 'takeItem', itemId: rundown.cursorItemId };
  if (command.instanceIdSeenOnAir !== undefined) {
    takeOfTheCursorItem.instanceIdSeenOnAir = command.instanceIdSeenOnAir;
  }
  return reduceTakeItem(slices, takeOfTheCursorItem, context);
}
