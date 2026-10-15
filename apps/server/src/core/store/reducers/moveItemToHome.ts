import { isSameItemHome, type Item, type MoveItemToHomeCommand } from '@bajaovrlay/shared';

import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import { findRefusalOfUnknownItemHome } from './itemHomeExistence.js';
import { listItemsOfHomeInOrder, numberItemsByPositionInList } from './itemOrdering.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import {
  giveCursorToFirstItemOfEmptyRundown,
  moveRundownCursorOffLeavingItem,
} from './rundownCursor.js';

/**
 * moveItemToHome: moves an item to a home (a rundown or a quick-fire panel) at the
 * position the command names (a position past the end means the end). Both homes are
 * renumbered 0, 1, 2, ... with no gaps: the one the item leaves closes up, the one it
 * joins makes room. Refused if the item, or the rundown or panel named, does not exist.
 *
 * The cursors follow the rules of the commands this move looks like. Leaving a rundown
 * is a deleteItem for that rundown: a cursor on the item moves to the item that followed
 * it, or to nothing. Joining an empty rundown is a createItem: the item gets the cursor.
 * Moving within the item's own home is a reorder: the cursor stays on the same item,
 * and a move to where the item already is hands back the same slices.
 * An instance on air from the item keeps its itemId and stays on air.
 */
export function reduceMoveItemToHome(
  slices: SlicesChangedByCommands,
  command: MoveItemToHomeCommand,
): ReducerOutcome {
  const movedItem = slices.items.find((item) => item.id === command.itemId);
  if (movedItem === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }
  const refusalOfTheHome = findRefusalOfUnknownItemHome(slices, command.home);
  if (refusalOfTheHome !== undefined) {
    return { status: 'refused', error: refusalOfTheHome };
  }

  if (isSameItemHome(movedItem.home, command.home)) {
    return moveItemWithinItsHome(slices, movedItem, command.order);
  }
  return moveItemToAnotherHome(slices, movedItem, command);
}

/** The move within one home: a reorder of that home, the cursor left alone. */
function moveItemWithinItsHome(
  slices: SlicesChangedByCommands,
  movedItem: Item,
  requestedOrder: number,
): ReducerOutcome {
  const otherItemIdsInOrder = listItemsOfHomeInOrder(slices.items, movedItem.home)
    .map((item) => item.id)
    .filter((itemId) => itemId !== movedItem.id);
  const positionOfMovedItem = Math.min(requestedOrder, otherItemIdsInOrder.length);
  if (positionOfMovedItem === movedItem.order) {
    return { status: 'applied', slices };
  }

  const itemIdsInNewOrder = [...otherItemIdsInOrder];
  itemIdsInNewOrder.splice(positionOfMovedItem, 0, movedItem.id);
  const itemsAfter = numberItemsByPositionInList(slices.items, itemIdsInNewOrder);
  return { status: 'applied', slices: { ...slices, items: itemsAfter } };
}

/** The move to another home: the old home closes up, the new one makes room. */
function moveItemToAnotherHome(
  slices: SlicesChangedByCommands,
  movedItem: Item,
  command: MoveItemToHomeCommand,
): ReducerOutcome {
  // Worked out before the item moves, while "the item after it" can still be found.
  const rundownsAfterLeaving = moveRundownCursorOffLeavingItem(
    slices.rundowns,
    slices.items,
    movedItem,
  );

  const itemIdsLeftBehindInOrder = listItemsOfHomeInOrder(slices.items, movedItem.home)
    .map((item) => item.id)
    .filter((itemId) => itemId !== movedItem.id);
  const itemsAlreadyInNewHome = listItemsOfHomeInOrder(slices.items, command.home);
  const positionInNewHome = Math.min(command.order, itemsAlreadyInNewHome.length);
  const itemIdsOfNewHomeInOrder = itemsAlreadyInNewHome.map((item) => item.id);
  itemIdsOfNewHomeInOrder.splice(positionInNewHome, 0, movedItem.id);

  const movedItemInItsNewHome: Item = {
    ...movedItem,
    home: command.home,
    order: positionInNewHome,
  };
  const itemsWithTheMovedOneRehomed = slices.items.map((item) =>
    item.id === movedItem.id ? movedItemInItsNewHome : item,
  );
  const itemsWithOldHomeClosedUp = numberItemsByPositionInList(
    itemsWithTheMovedOneRehomed,
    itemIdsLeftBehindInOrder,
  );
  const itemsAfter = numberItemsByPositionInList(itemsWithOldHomeClosedUp, itemIdsOfNewHomeInOrder);

  const rundownsAfter = giveCursorToFirstItemOfEmptyRundown(
    rundownsAfterLeaving,
    itemsAlreadyInNewHome,
    movedItemInItsNewHome,
  );
  return { status: 'applied', slices: { ...slices, items: itemsAfter, rundowns: rundownsAfter } };
}
