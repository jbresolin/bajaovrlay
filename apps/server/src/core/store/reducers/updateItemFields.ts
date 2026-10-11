import { isDeepStrictEqual } from 'node:util';

import type { Item, UpdateItemFieldsCommand } from '@bajaovrlay/shared';

import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateItemFields: changes the parts of an item the command names (field values,
 * label, colour, notes, auto-out delay) and keeps every other part. Field values are
 * merged key by key over the item's own. Refused if the item does not exist.
 * An update that leaves the item exactly as it was hands back the same slices.
 * What could go wrong: a graphic already on air from this item keeps the data it was
 * taken with; the change shows only the next time the item is taken.
 */
export function reduceUpdateItemFields(
  slices: SlicesChangedByCommands,
  command: UpdateItemFieldsCommand,
): ReducerOutcome {
  const itemBefore = slices.items.find((item) => item.id === command.itemId);
  if (itemBefore === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }

  const itemAfter = buildItemWithChangedParts(itemBefore, command);
  // Compared by content: the editor may save a form the operator did not touch, and
  // that must not be saved and broadcast as if something had changed.
  if (isDeepStrictEqual(itemAfter, itemBefore)) {
    return { status: 'applied', slices };
  }
  const itemsAfter = slices.items.map((item) => (item.id === itemBefore.id ? itemAfter : item));
  return { status: 'applied', slices: { ...slices, items: itemsAfter } };
}

/** A copy of the item with each part the command names replaced, and the rest kept. */
function buildItemWithChangedParts(itemBefore: Item, command: UpdateItemFieldsCommand): Item {
  const itemAfter: Item = { ...itemBefore };
  if (command.fields !== undefined) {
    itemAfter.fields = { ...itemBefore.fields, ...command.fields };
  }
  if (command.label !== undefined) {
    itemAfter.label = command.label;
  }
  if (command.color !== undefined) {
    itemAfter.color = command.color;
  }
  if (command.notes !== undefined) {
    itemAfter.notes = command.notes;
  }
  // Three cases for the delay: left out keeps it, null removes it, a number sets it.
  if (command.autoOutAfterMs === null) {
    delete itemAfter.autoOutAfterMs;
  } else if (command.autoOutAfterMs !== undefined) {
    itemAfter.autoOutAfterMs = command.autoOutAfterMs;
  }
  return itemAfter;
}
