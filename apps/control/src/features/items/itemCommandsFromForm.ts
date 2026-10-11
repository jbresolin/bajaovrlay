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
import {
  buildRaceClockItemFieldsFromFormValues,
  hasReferenceMomentTheClockCanUse,
  isStoredReferenceTimeTheOneTheFormHolds,
} from './raceClockItemFields';

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
  /** Date.now() at the press; it becomes the clock's reference moment. */
  nowInMilliseconds: number;
};

/**
 * Builds the `createItem` command for a new item. No `order` is sent, so the server
 * puts the item at the end of the rundown. A graphic without a form gets empty fields.
 */
export function buildCreateItemCommand(parts: CreateItemCommandParts): CreateItemCommand {
  const { rundownId, itemFormValues, raceClockFormValues, nowInMilliseconds } = parts;

  const fields: ItemFields =
    raceClockFormValues === undefined
      ? {}
      : buildRaceClockItemFieldsFromFormValues(raceClockFormValues, nowInMilliseconds);

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
 * Answers whether the stored field holds the same literal as the one built from the
 * form. The race clock's values are text, numbers and booleans, so `===` compares them
 * fully. A missing stored field, or one of another kind, is never "the same".
 */
function isStoredFieldTheSameLiteral(
  fieldFromTheForm: FieldValue,
  fieldOnTheItem: FieldValue | undefined,
): boolean {
  if (fieldOnTheItem === undefined) {
    return false;
  }
  // PLACEHOLDER (BAJAOVRLAY-13 gate 2): only literals are compared. The form builds no
  // `takeTime` field yet, so the first check below never fires today; it is here because
  // only a literal has a `value` to read. A stored `takeTime` counts as changed.
  if (fieldFromTheForm.kind !== 'literal') {
    return false;
  }
  if (fieldOnTheItem.kind !== 'literal') {
    return false;
  }
  return fieldOnTheItem.value === fieldFromTheForm.value;
}

/**
 * The race clock fields an update must send: the ones whose value differs from the
 * stored item. The time counts as different only when the form shows another mm:ss than
 * the stored time does. The reference moment is special. Built from "now", it always differs
 * from the stored one, yet sending it alone would shift a running clock. So it travels
 * only together with a changed time or a changed "running" (a new reference), or when
 * the stored item has none the clock can use.
 */
function findRaceClockFieldsThatChanged(
  fieldsFromTheForm: ItemFields,
  fieldsOnTheItem: ItemFields,
): ItemFields {
  const fieldsThatChanged: ItemFields = {};
  for (const fieldKey of Object.keys(fieldsFromTheForm)) {
    const fieldFromTheForm = fieldsFromTheForm[fieldKey];
    if (fieldFromTheForm === undefined || fieldKey === 'referenceWallClockMs') {
      continue;
    }
    // The time is judged first and by its own rule: the form works in whole seconds, so
    // a stored time with a part of a second would always look changed to `===` below,
    // and a label-only edit would then give a running clock a new reference.
    if (fieldKey === 'referenceTimeMs') {
      // PLACEHOLDER (BAJAOVRLAY-13 gate 2): the form always builds the time as a literal;
      // the kind is checked only because a `takeTime` has no `value` to read.
      const timeFromTheForm =
        fieldFromTheForm.kind === 'literal' ? fieldFromTheForm.value : undefined;
      const isTimeTheOneTheItemStores =
        typeof timeFromTheForm === 'number' &&
        isStoredReferenceTimeTheOneTheFormHolds(fieldsOnTheItem, timeFromTheForm);
      if (!isTimeTheOneTheItemStores) {
        fieldsThatChanged[fieldKey] = fieldFromTheForm;
      }
      continue;
    }
    if (!isStoredFieldTheSameLiteral(fieldFromTheForm, fieldsOnTheItem[fieldKey])) {
      fieldsThatChanged[fieldKey] = fieldFromTheForm;
    }
  }

  const isClockReferenceChanged =
    fieldsThatChanged.referenceTimeMs !== undefined || fieldsThatChanged.running !== undefined;
  const isStoredReferenceMomentMissing = !hasReferenceMomentTheClockCanUse(fieldsOnTheItem);
  const referenceMomentFromTheForm = fieldsFromTheForm.referenceWallClockMs;
  if (
    (isClockReferenceChanged || isStoredReferenceMomentMissing) &&
    referenceMomentFromTheForm !== undefined
  ) {
    fieldsThatChanged.referenceWallClockMs = referenceMomentFromTheForm;
  }
  return fieldsThatChanged;
}

/** What buildUpdateItemFieldsCommand needs. */
export type UpdateItemFieldsCommandParts = {
  /** The stored item as it was when the form was filled from it. */
  itemBeingEdited: Item;
  itemFormValues: ItemEditorFormValues;
  /** The race clock part of the form, or undefined for a graphic without a form. */
  raceClockFormValues: RaceClockTakeFormValues | undefined;
  /** Date.now() at the press; the reference moment of a clock whose time or state changed. */
  nowInMilliseconds: number;
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
  const { itemBeingEdited, itemFormValues, raceClockFormValues, nowInMilliseconds } = parts;
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
    const fieldsFromTheForm = buildRaceClockItemFieldsFromFormValues(
      raceClockFormValues,
      nowInMilliseconds,
    );
    const fieldsThatChanged = findRaceClockFieldsThatChanged(
      fieldsFromTheForm,
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
