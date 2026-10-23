import type { CreateItemCommand, Item } from '@bajaovrlay/shared';

import { refuseUnknownGraphic, refuseUnknownLayer } from '../commandRefusals.js';
import { findRefusalOfBindingFieldsForGraphic } from '../itemBindingFields.js';
import { findRefusalOfEntityFieldsForGraphic } from '../itemEntityFields.js';
import { findRefusalOfEventFieldsForGraphic } from '../itemEventFields.js';
import { findRefusalOfTakeTimeFieldsForGraphic } from '../itemTakeTimeFields.js';
import { findRefusalOfUnknownItemHome } from './itemHomeExistence.js';
import { listItemsOfHomeInOrder, numberItemsByPositionInList } from './itemOrdering.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { giveCursorToFirstItemOfEmptyRundown } from './rundownCursor.js';

/**
 * createItem: adds a prepared item to its home (a rundown or a quick-fire panel), at the
 * end or at the position the command names (the items from there on move down by one; a
 * position past the end means the end). Refused if the rundown or panel, the layer or the
 * graphic does not exist, or if
 * a field says takeTime and the graphic's schema does not mark that field as a
 * wall-clock moment (the check and the message of a take; a graphic without a schema
 * accepts no takeTime field), or if a binding cannot be stored (INVALID_BINDING: its
 * source does not exist, its parts make no sense, its value does not fit the field;
 * itemBindingFields.ts).
 * The first item of an empty rundown also gets the cursor, so "next" works at once; an
 * item of a panel never gets any cursor.
 * What could go wrong: typed field values are not checked against the graphic here, so
 * an item with a wrong value is only refused when it is taken.
 */
export function reduceCreateItem(
  slices: SlicesChangedByCommands,
  command: CreateItemCommand,
  context: ReducerContext,
): ReducerOutcome {
  const refusalOfTheHome = findRefusalOfUnknownItemHome(slices, command.home);
  if (refusalOfTheHome !== undefined) {
    return { status: 'refused', error: refusalOfTheHome };
  }
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const graphic = slices.graphics.find(
    (registeredGraphic) => registeredGraphic.id === command.graphicId,
  );
  if (graphic === undefined) {
    return { status: 'refused', error: refuseUnknownGraphic(command.graphicId) };
  }
  // Said now, while the rundown is being prepared, rather than at the press of Space on
  // air: a field may say takeTime only if the graphic marks it as a wall-clock moment.
  const refusalOfATakeTimeField = findRefusalOfTakeTimeFieldsForGraphic(graphic, command.fields);
  if (refusalOfATakeTimeField !== undefined) {
    return { status: 'refused', error: refusalOfATakeTimeField };
  }
  const refusalOfABinding = findRefusalOfBindingFieldsForGraphic(
    graphic,
    command.fields,
    command.fields,
    slices.dataSources,
  );
  if (refusalOfABinding !== undefined) {
    return { status: 'refused', error: refusalOfABinding };
  }
  const refusalOfAnEventField = findRefusalOfEventFieldsForGraphic(graphic, command.fields);
  if (refusalOfAnEventField !== undefined) {
    return { status: 'refused', error: refusalOfAnEventField };
  }
  const refusalOfAnEntityField = findRefusalOfEntityFieldsForGraphic(
    graphic,
    command.fields,
    slices,
  );
  if (refusalOfAnEntityField !== undefined) {
    return { status: 'refused', error: refusalOfAnEntityField };
  }

  const itemsAlreadyInHome = listItemsOfHomeInOrder(slices.items, command.home);
  const positionAtTheEnd = itemsAlreadyInHome.length;
  const positionOfNewItem = Math.min(command.order ?? positionAtTheEnd, positionAtTheEnd);

  const newItem: Item = {
    id: context.newItemId,
    home: command.home,
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

  // The home's ids in their new order, with the new item slotted in, give every item
  // its position; only the items after the new one actually change.
  const itemIdsInNewOrder = itemsAlreadyInHome.map((item) => item.id);
  itemIdsInNewOrder.splice(positionOfNewItem, 0, newItem.id);
  const itemsAfter = numberItemsByPositionInList([...slices.items, newItem], itemIdsInNewOrder);

  const rundownsAfter = giveCursorToFirstItemOfEmptyRundown(
    slices.rundowns,
    itemsAlreadyInHome,
    newItem,
  );

  return { status: 'applied', slices: { ...slices, items: itemsAfter, rundowns: rundownsAfter } };
}
