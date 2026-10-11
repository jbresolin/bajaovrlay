/**
 * The three commands the item editor can send, built from values that already passed
 * their rules: `createItem` for a new item (the whole form), `updateItemFields` for a
 * stored one (only what differs from the stored item) and `updateInstanceData` for
 * "Atualizar no ar" (the changed fields of the item's instance on air). Pure functions,
 * no drawing.
 *
 * The graphic's own fields arrive here already built by features/schemaForm, which reads
 * them from the generated form; this file knows nothing about any graphic. What it adds
 * is the part every item has: label, colour, notes and auto-out.
 *
 * Sending only the changes is a deliberate choice: the server merges an update part by
 * part, so two operators who change different parts of one item both keep their change.
 * What could go wrong: "changed" is judged against the item handed in, so the caller
 * must pass the item as it was when the form was filled, not a newer copy.
 */
import type {
  CreateItemCommand,
  Item,
  ItemFields,
  UpdateInstanceDataCommand,
  UpdateItemFieldsCommand,
} from '@bajaovrlay/shared';

import { buildInstanceUpdateDataFromChangedItemFields } from '@/features/schemaForm';

import {
  convertAutoOutSecondsTextToMilliseconds,
  type ItemEditorFormValues,
} from './itemEditorForm';

/** What buildCreateItemCommand needs. */
export type CreateItemCommandParts = {
  rundownId: string;
  itemFormValues: ItemEditorFormValues;
  /**
   * Every field of the graphic as the generated form holds it
   * (buildItemFieldsFromSchemaForm); empty for a graphic that takes no data.
   */
  fields: ItemFields;
};

/**
 * Builds the `createItem` command for a new item. No `order` is sent, so the server
 * puts the item at the end of the rundown.
 */
export function buildCreateItemCommand(parts: CreateItemCommandParts): CreateItemCommand {
  const { rundownId, itemFormValues, fields } = parts;

  const command: CreateItemCommand = {
    type: 'createItem',
    rundownId,
    graphicId: itemFormValues.graphicId,
    layerId: itemFormValues.layerId,
    label: itemFormValues.label.trim(),
    color: itemFormValues.color,
    notes: itemFormValues.notes,
    fields,
  };
  // "No auto-out" is said by leaving the key out; the server refuses zero and null here.
  const autoOutAfterMs = convertAutoOutSecondsTextToMilliseconds(
    itemFormValues.autoOutAfterSeconds,
  );
  if (autoOutAfterMs !== undefined) {
    command.autoOutAfterMs = autoOutAfterMs;
  }
  return command;
}

/** What buildUpdateItemFieldsCommand needs. */
export type UpdateItemFieldsCommandParts = {
  /** The stored item as it was when the form was filled from it. */
  itemBeingEdited: Item;
  itemFormValues: ItemEditorFormValues;
  /**
   * Only the graphic's fields in which the generated form differs from the stored item
   * (buildChangedItemFieldsFromSchemaForm); empty when none does.
   */
  changedFields: ItemFields;
};

/**
 * Builds the `updateItemFields` command for a stored item, carrying only the parts that
 * differ from it. Returns undefined when nothing differs, so the caller sends nothing.
 * The graphic and the layer are never sent: the command cannot change them.
 */
export function buildUpdateItemFieldsCommand(
  parts: UpdateItemFieldsCommandParts,
): UpdateItemFieldsCommand | undefined {
  const { itemBeingEdited, itemFormValues, changedFields } = parts;
  const command: UpdateItemFieldsCommand = { type: 'updateItemFields', itemId: itemBeingEdited.id };

  const labelFromTheForm = itemFormValues.label.trim();
  if (labelFromTheForm !== itemBeingEdited.label) {
    command.label = labelFromTheForm;
  }
  if (itemFormValues.color !== itemBeingEdited.color) {
    command.color = itemFormValues.color;
  }
  if (itemFormValues.notes !== itemBeingEdited.notes) {
    command.notes = itemFormValues.notes;
  }

  // A number sets the delay and null removes it; an unchanged delay is left out.
  const autoOutFromTheForm = convertAutoOutSecondsTextToMilliseconds(
    itemFormValues.autoOutAfterSeconds,
  );
  if (autoOutFromTheForm !== itemBeingEdited.autoOutAfterMs) {
    command.autoOutAfterMs = autoOutFromTheForm === undefined ? null : autoOutFromTheForm;
  }

  const hasAnyFieldChanged = Object.keys(changedFields).length > 0;
  if (hasAnyFieldChanged) {
    command.fields = changedFields;
  }

  const isAnythingChanged =
    command.label !== undefined ||
    command.color !== undefined ||
    command.notes !== undefined ||
    command.autoOutAfterMs !== undefined ||
    command.fields !== undefined;
  return isAnythingChanged ? command : undefined;
}

/** What buildUpdateInstanceDataCommandFromChangedFields needs. */
export type UpdateInstanceDataCommandParts = {
  /** The instance of the item on the program output (findInstanceOfItemOnProgram). */
  instanceId: string;
  /** The same changed fields the `updateItemFields` of this press was built from. */
  changedFields: ItemFields;
};

/**
 * Builds the `updateInstanceData` command of "Atualizar no ar": each changed field that
 * holds a typed value goes on air as that value, and a cleared one as null, which takes
 * it off air. Returns undefined when no such field changed, so the caller sends nothing
 * (a new label or colour is not something the audience sees).
 * A field changed to "filled by the server at the take" is left out, and the list of
 * fields for the server to stamp is always empty: the moment already on air stays until
 * the item is taken again. Stamping it here would restart a running clock on air.
 */
export function buildUpdateInstanceDataCommandFromChangedFields(
  parts: UpdateInstanceDataCommandParts,
): UpdateInstanceDataCommand | undefined {
  const data = buildInstanceUpdateDataFromChangedItemFields(parts.changedFields);
  const hasAnythingToChangeOnAir = Object.keys(data).length > 0;
  if (!hasAnythingToChangeOnAir) {
    return undefined;
  }
  return {
    type: 'updateInstanceData',
    instanceId: parts.instanceId,
    data,
    takeTimeFieldKeys: [],
  };
}
