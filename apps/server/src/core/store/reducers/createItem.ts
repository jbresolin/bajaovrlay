import { type CreateItemCommand, type Item, listItemsOfRundownInOrder } from '@bajaovrlay/shared';

import { refuseUnknownGraphic, refuseUnknownLayer } from '../commandRefusals.js';
import { refuseUnknownRundown } from '../rundownCommandRefusals.js';
import { numberItemsByPositionInList } from './itemOrdering.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { putRundownCursorOnItem } from './rundownCursor.js';

/**
 * createItem: adds a prepared item to a rundown, at the end or at the position the
 * command names (the items from there on move down by one; a position past the end
 * means the end). Refused if the rundown, the layer or the graphic does not exist.
 * The first item of an empty rundown also gets the cursor, so "next" works at once.
 * What could go wrong: the field values are not checked against the graphic here, so
 * an item with a wrong value is only refused when it is taken.
 */
export function reduceCreateItem(
  slices: SlicesChangedByCommands,
  command: CreateItemCommand,
  context: ReducerContext,
): ReducerOutcome {
  const rundownExists = slices.rundowns.some((rundown) => rundown.id === command.rundownId);
  if (!rundownExists) {
    return { status: 'refused', error: refuseUnknownRundown(command.rundownId) };
  }
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const graphicIsRegistered = slices.graphics.some((graphic) => graphic.id === command.graphicId);
  if (!graphicIsRegistered) {
    return { status: 'refused', error: refuseUnknownGraphic(command.graphicId) };
  }

  const itemsAlreadyInRundown = listItemsOfRundownInOrder(slices.items, command.rundownId);
  const positionAtTheEnd = itemsAlreadyInRundown.length;
  const positionOfNewItem = Math.min(command.order ?? positionAtTheEnd, positionAtTheEnd);

  const newItem: Item = {
    id: context.newItemId,
    rundownId: command.rundownId,
    order: positionOfNewItem,
    graphicId: command.graphicId,
    layerId: command.layerId,
    fields: command.fields,
    label: command.label,
    color: command.color,
    notes: command.notes,
  };
  // Left out rather than set to undefined: the item schema refuses the key with no value.
  if (command.autoOutAfterMs !== undefined) {
    newItem.autoOutAfterMs = command.autoOutAfterMs;
  }

  // The rundown's ids in their new order, with the new item slotted in, give every
  // item its position; only the items after the new one actually change.
  const itemIdsInNewOrder = itemsAlreadyInRundown.map((item) => item.id);
  itemIdsInNewOrder.splice(positionOfNewItem, 0, newItem.id);
  const itemsAfter = numberItemsByPositionInList([...slices.items, newItem], itemIdsInNewOrder);

  const isFirstItemOfRundown = itemsAlreadyInRundown.length === 0;
  const rundownsAfter = isFirstItemOfRundown
    ? putRundownCursorOnItem(slices.rundowns, command.rundownId, newItem.id)
    : slices.rundowns;

  return { status: 'applied', slices: { ...slices, items: itemsAfter, rundowns: rundownsAfter } };
}
