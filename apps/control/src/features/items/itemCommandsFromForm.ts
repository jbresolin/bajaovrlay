/**
 * The two commands "Salvar item" can send, built from form values that already passed
 * their rules: `createItem` for a new item (the whole form) and `updateItemFields` for a
 * stored one (only what differs from the stored item). Pure functions, no drawing.
 *
 * Sending only the changes is a deliberate choice: the server merges an update part by
 * part, so two operators who change different parts of one item both keep their change.
 * What could go wrong: "changed" is judged against the item handed in, so the caller
 * must pass the item as it was when the form was filled, not a newer copy.
 */
import type {
  CreateItemCommand,
  FieldValue,
  Item,
  ItemFields,
  UpdateItemFieldsCommand,
} from '@bajaovrlay/shared';

import {
  raceClockGraphicId,
  type RaceClockTakeFormValues,
} from '@/features/playout/raceClockTakeForm';

import {
  convertAutoOutSecondsTextToMilliseconds,
  type ItemEditorFormValues,
} from './itemEditorForm';
import { buildRaceClockItemFieldsFromFormValues } from './raceClockItemFields';
import { applyRaceClockReferenceRules } from './raceClockReferenceRules';

/** Answers whether a graphic is the one the editor has a hand-written form for. */
export function isGraphicTheRaceClock(graphicId: string): boolean {
  return graphicId === raceClockGraphicId;
}

/** What buildCreateItemCommand needs. */
export type CreateItemCommandParts = {
  rundownId: string;
  itemFormValues: ItemEditorFormValues;
  /** The race clock part of the form, or undefined for a graphic without a form. */
  raceClockFormValues: RaceClockTakeFormValues | undefined;
};

/**
 * Builds the `createItem` command for a new item. No `order` is sent, so the server
 * puts the item at the end of the rundown. A graphic without a form gets empty fields.
 */
export function buildCreateItemCommand(parts: CreateItemCommandParts): CreateItemCommand {
  const { rundownId, itemFormValues, raceClockFormValues } = parts;

  const fields: ItemFields =
    raceClockFormValues === undefined
      ? {}
      : buildRaceClockItemFieldsFromFormValues(raceClockFormValues);

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

/**
 * Answers whether the stored field says the same as the one built from the form. Two
 * literals are the same when their values are (the form's values are text, numbers and
 * booleans, so `===` compares them fully); "the moment of the take" is the same as
 * itself. A missing stored field, or one of another kind, is never "the same".
 */
function isStoredFieldTheSameAsTheOneFromTheForm(
  fieldFromTheForm: FieldValue,
  fieldOnTheItem: FieldValue | undefined,
): boolean {
  if (fieldOnTheItem === undefined) {
    return false;
  }
  if (fieldFromTheForm.kind === 'literal') {
    return fieldOnTheItem.kind === 'literal' && fieldOnTheItem.value === fieldFromTheForm.value;
  }
  return fieldOnTheItem.kind === fieldFromTheForm.kind;
}

/**
 * The fields built from the form that differ from the stored item, whatever the graphic.
 * It knows nothing about what any field means; the race clock's own exceptions are
 * applied afterwards, by applyRaceClockReferenceRules.
 */
function findFieldsThatDifferFromTheStoredOnes(
  fieldsFromTheForm: ItemFields,
  fieldsOnTheItem: ItemFields,
): ItemFields {
  const fieldsThatDiffer: ItemFields = {};
  for (const fieldKey of Object.keys(fieldsFromTheForm)) {
    const fieldFromTheForm = fieldsFromTheForm[fieldKey];
    if (fieldFromTheForm === undefined) {
      continue;
    }
    if (!isStoredFieldTheSameAsTheOneFromTheForm(fieldFromTheForm, fieldsOnTheItem[fieldKey])) {
      fieldsThatDiffer[fieldKey] = fieldFromTheForm;
    }
  }
  return fieldsThatDiffer;
}

/** What buildUpdateItemFieldsCommand needs. */
export type UpdateItemFieldsCommandParts = {
  /** The stored item as it was when the form was filled from it. */
  itemBeingEdited: Item;
  itemFormValues: ItemEditorFormValues;
  /** The race clock part of the form, or undefined for a graphic without a form. */
  raceClockFormValues: RaceClockTakeFormValues | undefined;
};

/**
 * Builds the `updateItemFields` command for a stored item, carrying only the parts that
 * differ from it. Returns undefined when nothing differs, so the caller sends nothing.
 * The graphic and the layer are never sent: the command cannot change them.
 * What could go wrong: blank laps over stored laps are simply not sent (the command
 * cannot remove a field); the panel refuses that save before calling this.
 */
export function buildUpdateItemFieldsCommand(
  parts: UpdateItemFieldsCommandParts,
): UpdateItemFieldsCommand | undefined {
  const { itemBeingEdited, itemFormValues, raceClockFormValues } = parts;
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

  if (raceClockFormValues !== undefined) {
    const fieldsFromTheForm = buildRaceClockItemFieldsFromFormValues(raceClockFormValues);
    const fieldsThatDiffer = findFieldsThatDifferFromTheStoredOnes(
      fieldsFromTheForm,
      itemBeingEdited.fields,
    );
    // The form here is the race clock's, so the clock's own rules have the last word on
    // its time and its reference moment (raceClockReferenceRules.ts; gone in BAJAOVRLAY-14).
    const fieldsThatChanged = applyRaceClockReferenceRules(
      fieldsThatDiffer,
      itemBeingEdited.fields,
    );
    const hasAnyFieldChanged = Object.keys(fieldsThatChanged).length > 0;
    if (hasAnyFieldChanged) {
      command.fields = fieldsThatChanged;
    }
  }

  const isAnythingChanged =
    command.label !== undefined ||
    command.color !== undefined ||
    command.notes !== undefined ||
    command.autoOutAfterMs !== undefined ||
    command.fields !== undefined;
  return isAnythingChanged ? command : undefined;
}
