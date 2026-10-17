import type { TakeItemCommand } from '@bajaovrlay/shared';

import { putItemOnOutput } from './putItemOnOutput.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorOnIfItWasOnTakenItem } from './rundownCursor.js';

/**
 * takeItem: puts a prepared item on the program output. putItemOnOutput does the take
 * (it resolves the item's field values into data, a `takeTime` field getting the moment
 * of this command, the same one the instance's `takenAt` says; and hands the take, with
 * the item's id, to the take step putGraphicOnOutput, which stamps that id on the new
 * instance), and
 * previewItem goes through the same function for the preview output. If the item taken
 * was the one the rundown's cursor was on, the cursor then moves to the item after it;
 * after the last item the cursor is on nothing, rather than back at the top where "next"
 * would fire the opening again, and the rundown is marked as played to its end
 * (`wasLastItemTakenAtCursor`). Taking any other item leaves the cursor alone. Refused
 * if the item does not exist, if a field cannot be resolved, or for any reason the take
 * step refuses (the item's layer or graphic is gone, a `takeTime` field is not a
 * wall-clock moment in the graphic's schema, the data breaks that schema); nothing
 * changes then.
 */
export function reduceTakeItem(
  slices: SlicesChangedByCommands,
  command: TakeItemCommand,
  context: ReducerContext,
): ReducerOutcome {
  const takeOutcome = putItemOnOutput(slices, command.itemId, 'program', context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }
  const rundownsAfter = moveRundownCursorOnIfItWasOnTakenItem(
    slices.rundowns,
    slices.items,
    takeOutcome.item,
  );
  return { status: 'applied', slices: { ...takeOutcome.slices, rundowns: rundownsAfter } };
}
