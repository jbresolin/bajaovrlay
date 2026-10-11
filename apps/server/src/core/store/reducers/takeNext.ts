import type { TakeNextCommand } from '@bajaovrlay/shared';

import { refuseTakeWithEmptyCursor, refuseUnknownRundown } from '../rundownCommandRefusals.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeItem } from './takeItem.js';

/**
 * takeNext: takes the item a rundown's cursor is on (what the Space key sends). It is
 * a takeItem of that item and nothing more, so the instance, the cursor moving on and
 * the refusals are all takeItem's. Refused if the rundown does not exist, or if its
 * cursor is on nothing: the server never guesses which item the operator meant.
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
  return reduceTakeItem(slices, { type: 'takeItem', itemId: rundown.cursorItemId }, context);
}
