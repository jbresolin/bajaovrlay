import { listItemsOfRundownInOrder, type ReorderItemsCommand } from '@bajaovrlay/shared';

import {
  refuseOrderThatIsNotAPermutation,
  refuseUnknownRundown,
} from '../rundownCommandRefusals.js';
import { numberItemsByPositionInList } from './itemOrdering.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * reorderItems: puts a rundown's items in the order of the list sent, which must be
 * the whole rundown: every one of its items, once each, and nothing else. Anything
 * else is refused, because applying it would leave two items in one position or move
 * an item of another rundown. The cursor stays on the same item wherever it moved to.
 * A list that is already the current order hands back the same slices.
 */
export function reduceReorderItems(
  slices: SlicesChangedByCommands,
  command: ReorderItemsCommand,
): ReducerOutcome {
  const rundown = slices.rundowns.find((candidate) => candidate.id === command.rundownId);
  if (rundown === undefined) {
    return { status: 'refused', error: refuseUnknownRundown(command.rundownId) };
  }

  // The shared schema already refused a list with the same id twice. So a list of the
  // right length whose every id is an item of this rundown names each item exactly once.
  const itemIdsInCurrentOrder = listItemsOfRundownInOrder(slices.items, rundown.id).map(
    (item) => item.id,
  );
  const hasSameNumberOfItems = command.orderedItemIds.length === itemIdsInCurrentOrder.length;
  const isEveryIdAnItemOfRundown = command.orderedItemIds.every((itemId) =>
    itemIdsInCurrentOrder.includes(itemId),
  );
  if (!hasSameNumberOfItems || !isEveryIdAnItemOfRundown) {
    return { status: 'refused', error: refuseOrderThatIsNotAPermutation(rundown.name) };
  }

  const isAlreadyInThatOrder = command.orderedItemIds.every(
    (itemId, position) => itemIdsInCurrentOrder[position] === itemId,
  );
  if (isAlreadyInThatOrder) {
    return { status: 'applied', slices };
  }
  const itemsAfter = numberItemsByPositionInList(slices.items, command.orderedItemIds);
  return { status: 'applied', slices: { ...slices, items: itemsAfter } };
}
