import { isDeepStrictEqual } from 'node:util';

import type { CommandError, Item, UpdateItemFieldsCommand } from '@bajaovrlay/shared';

import { refuseUnknownGraphic, refuseUnknownLayer } from '../commandRefusals.js';
import { removeKeysFromFieldsChangedOnAirOfItem } from '../fieldsChangedOnAir.js';
import { findRefusalOfBindingFieldsForGraphic } from '../itemBindingFields.js';
import { findRefusalOfEntityFieldsForGraphic } from '../itemEntityFields.js';
import { findRefusalOfEventFieldsForGraphic } from '../itemEventFields.js';
import {
  findRefusalOfTakeTimeFieldsForGraphic,
  listKeysOfTakeTimeFields,
} from '../itemTakeTimeFields.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import { findRefusalOfItemInTheWrongHome } from './itemHomeOfEventTemplates.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateItemFields: changes the parts of an item the command names (field values,
 * label, colour, notes, auto-out delay and, since BAJAOVRLAY-36, the layer) and keeps
 * every other part. The command keeps its older name, which says "fields", to avoid
 * churn in every client and in the event log. Field values are merged key by key over
 * the item's own. The graphic cannot change: the command schema has no graphicId and
 * drops one sent anyway. Refused if the item or the new layer does not exist, or if a
 * field value in the command says takeTime and the item's graphic does not mark that
 * field as a wall-clock moment (the check and the message of a take), or if a binding in
 * the command cannot be stored (INVALID_BINDING, the check of createItem).
 * An update that leaves the item exactly as it was hands back the same slices. A field
 * whose stored value changed leaves the list of fields changed on air of the item's live
 * instances, on program and in preview.
 * What could go wrong: a graphic already on air from this item keeps the data and the
 * layer it was taken with; the change shows only the next time the item is taken, so
 * after a layer change the old instance stays on its layer beside the next take.
 */
export function reduceUpdateItemFields(
  slices: SlicesChangedByCommands,
  command: UpdateItemFieldsCommand,
): ReducerOutcome {
  const itemBefore = slices.items.find((item) => item.id === command.itemId);
  if (itemBefore === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }
  const newLayerId = command.layerId;
  if (newLayerId !== undefined) {
    const newLayerExists = slices.layers.some((layer) => layer.id === newLayerId);
    if (!newLayerExists) {
      return { status: 'refused', error: refuseUnknownLayer(newLayerId) };
    }
  }
  const refusalOfATakeTimeField = findRefusalOfTakeTimeFieldsInCommand(slices, itemBefore, command);
  if (refusalOfATakeTimeField !== undefined) {
    return { status: 'refused', error: refusalOfATakeTimeField };
  }

  const itemAfter = buildItemWithChangedParts(itemBefore, command);
  const refusalOfABinding = findRefusalOfBindingsInCommand(slices, itemBefore, itemAfter, command);
  if (refusalOfABinding !== undefined) {
    return { status: 'refused', error: refusalOfABinding };
  }
  // A button given an "Evento" field, or a template losing its last one (BAJAOVRLAY-67).
  const refusalOfTheHome = findRefusalOfItemInTheWrongHome(
    itemAfter.home,
    itemAfter.fields,
    itemAfter.label,
  );
  if (refusalOfTheHome !== undefined) {
    return { status: 'refused', error: refusalOfTheHome };
  }
  // Compared by content: the editor may save a form the operator did not touch, and
  // that must not be saved and broadcast as if something had changed.
  if (isDeepStrictEqual(itemAfter, itemBefore)) {
    return { status: 'applied', slices };
  }
  const itemsAfter = slices.items.map((item) => (item.id === itemBefore.id ? itemAfter : item));
  // A field whose stored value this save changed is the item's newest word on it: it
  // leaves the "alterado no ar" list of the item's live instances, so a later "Salvar no
  // item" cannot write the older value from the air over it (gate 2 of PR #15).
  const keysOfFieldsChanged = Object.keys(itemAfter.fields).filter(
    (fieldKey) => !isDeepStrictEqual(itemAfter.fields[fieldKey], itemBefore.fields[fieldKey]),
  );
  const instancesAfter = removeKeysFromFieldsChangedOnAirOfItem(
    slices.instances,
    itemBefore.id,
    keysOfFieldsChanged,
  );
  return { status: 'applied', slices: { ...slices, items: itemsAfter, instances: instancesAfter } };
}

/**
 * The refusal for a takeTime value the command carries on a field the item's graphic does
 * not mark as a wall-clock moment, or undefined when the command may go on.
 * Only the fields in the command are judged. A takeTime the item already holds on a
 * wrong field (saved before this check, or before the manifest changed) is left alone,
 * so such an item can still be renamed or repaired; the take refuses it anyway.
 * Deliberate: checked before the "nothing changed" comparison, so a wrong takeTime that
 * a client of the API sends again is refused even though the item already holds it. (The
 * control page's editor cannot send one: it offers takeTime on wall-clock fields only.)
 * Deliberate: when the item's graphic is no longer registered there is no manifest to
 * say the field is a moment, so a command carrying a takeTime value is refused with
 * GRAPHIC_NOT_FOUND, while one carrying none is applied as it always was.
 */
function findRefusalOfTakeTimeFieldsInCommand(
  slices: SlicesChangedByCommands,
  itemBefore: Item,
  command: UpdateItemFieldsCommand,
): CommandError | undefined {
  const fieldsInCommand = command.fields ?? {};
  const commandCarriesATakeTimeField = listKeysOfTakeTimeFields(fieldsInCommand).length > 0;
  if (!commandCarriesATakeTimeField) {
    return undefined;
  }
  const graphicOfTheItem = slices.graphics.find((graphic) => graphic.id === itemBefore.graphicId);
  if (graphicOfTheItem === undefined) {
    return refuseUnknownGraphic(itemBefore.graphicId);
  }
  return findRefusalOfTakeTimeFieldsForGraphic(graphicOfTheItem, fieldsInCommand);
}

/**
 * The refusal for a binding or an entity reference the command carries that cannot be
 * stored, or for a field that would sit beside a whole clock, or undefined. Like the
 * takeTime check above, a graphic no longer registered refuses a command carrying a
 * binding or a reference with GRAPHIC_NOT_FOUND (no manifest to fit it to), and lets any
 * other command through.
 * The whole-clock check reads the item as it will be stored, merged, so a takeTime sent
 * onto the moment of a clock bound whole is refused as well. An event field whose payload
 * field does not fit is refused after the bindings and before the entity references
 * (BAJAOVRLAY-44).
 */
function findRefusalOfBindingsInCommand(
  slices: SlicesChangedByCommands,
  itemBefore: Item,
  itemAfter: Item,
  command: UpdateItemFieldsCommand,
): CommandError | undefined {
  if (command.fields === undefined) {
    return undefined;
  }
  const commandCarriesABindingOrAReference = Object.values(command.fields).some(
    (fieldValue) =>
      fieldValue.kind === 'binding' ||
      fieldValue.kind === 'entity' ||
      fieldValue.kind === 'entityList',
  );
  const graphicOfTheItem = slices.graphics.find((graphic) => graphic.id === itemBefore.graphicId);
  if (graphicOfTheItem === undefined) {
    return commandCarriesABindingOrAReference
      ? refuseUnknownGraphic(itemBefore.graphicId)
      : undefined;
  }
  const refusalOfABinding = findRefusalOfBindingFieldsForGraphic(
    graphicOfTheItem,
    command.fields,
    itemAfter.fields,
    slices.dataSources,
  );
  if (refusalOfABinding !== undefined) {
    return refusalOfABinding;
  }
  const refusalOfAnEventField = findRefusalOfEventFieldsForGraphic(
    graphicOfTheItem,
    command.fields,
  );
  if (refusalOfAnEventField !== undefined) {
    return refusalOfAnEventField;
  }
  return findRefusalOfEntityFieldsForGraphic(graphicOfTheItem, command.fields, slices);
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
  if (command.layerId !== undefined) {
    itemAfter.layerId = command.layerId;
  }
  // Three cases for the delay: left out keeps it, null removes it, a number sets it.
  if (command.autoOutAfterMs === null) {
    delete itemAfter.autoOutAfterMs;
  } else if (command.autoOutAfterMs !== undefined) {
    itemAfter.autoOutAfterMs = command.autoOutAfterMs;
  }
  return itemAfter;
}
