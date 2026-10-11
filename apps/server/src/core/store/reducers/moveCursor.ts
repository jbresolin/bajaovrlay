import type { MoveCursorCommand } from '@bajaovrlay/shared';

import {
  refuseItemOfAnotherRundown,
  refuseUnknownItem,
  refuseUnknownRundown,
} from '../rundownCommandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { putRundownCursorOnItem } from './rundownCursor.js';

/**
 * moveCursor: puts a rundown's cursor ("next") on one of its items, or on nothing
 * with null, without taking anything. Refused if the rundown or the item does not
 * exist, or if the item belongs to another rundown: "next" would then fire a graphic
 * that is not in the list the operator is looking at.
 * A cursor that is already there hands back the same slices.
 */
export function reduceMoveCursor(
  slices: SlicesChangedByCommands,
  command: MoveCursorCommand,
): ReducerOutcome {
  const rundown = slices.rundowns.find((candidate) => candidate.id === command.rundownId);
  if (rundown === undefined) {
    return { status: 'refused', error: refuseUnknownRundown(command.rundownId) };
  }

  if (command.itemId !== null) {
    const item = slices.items.find((candidate) => candidate.id === command.itemId);
    if (item === undefined) {
      return { status: 'refused', error: refuseUnknownItem(command.itemId) };
    }
    if (item.rundownId !== rundown.id) {
      return {
        status: 'refused',
        error: refuseItemOfAnotherRundown(item.label, rundown.name),
      };
    }
  }

  const rundownsAfter = putRundownCursorOnItem(slices.rundowns, rundown.id, command.itemId);
  if (rundownsAfter === slices.rundowns) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, rundowns: rundownsAfter } };
}
