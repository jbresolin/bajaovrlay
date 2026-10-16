import type { DeleteItemCommand } from '@bajaovrlay/shared';

import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import { listItemsOfHomeInOrder, numberItemsByPositionInList } from './itemOrdering.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorOffLeavingItem } from './rundownCursor.js';

/**
 * deleteItem: removes an item from its home (a rundown or a quick-fire panel) and moves
 * the items after it up by one. If a rundown's cursor was on the deleted item, it moves
 * to the item that followed it, or to nothing when the deleted item was the last.
 * Refused if the item does not exist.
 * A graphic already on air from the item is left on air, on purpose: preparing the
 * rundown must never change what viewers see.
 * What could go wrong: that instance keeps an `itemId` that no longer names any item,
 * so whoever reads it (the layer panel) must cope with not finding the item.
 */
export function reduceDeleteItem(
  slices: SlicesChangedByCommands,
  command: DeleteItemCommand,
): ReducerOutcome {
  const deletedItem = slices.items.find((item) => item.id === command.itemId);
  if (deletedItem === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }

  // Worked out before the item is removed, while "the item after it" can still be found.
  const rundownsAfter = moveRundownCursorOffLeavingItem(slices.rundowns, slices.items, deletedItem);

  const itemsKept = slices.items.filter((item) => item.id !== deletedItem.id);
  const itemIdsLeftInOrder = listItemsOfHomeInOrder(itemsKept, deletedItem.home).map(
    (item) => item.id,
  );
  const itemsAfter = numberItemsByPositionInList(itemsKept, itemIdsLeftInOrder);

  return { status: 'applied', slices: { ...slices, items: itemsAfter, rundowns: rundownsAfter } };
}
