/**
 * Checks what a generated form holds, field by field, and answers either one pt-BR
 * message per wrong field or the values as data, ready for the files that build
 * commands (`...FromSchemaForm.ts`). Pure: no react-hook-form, no clock.
 *
 * The order of the rules, for each field the form can edit:
 *  1. A field set to "filled by the server at the take" is not checked at all: it has no
 *     value yet, and the server writes one. Neither is a clock field the whole clock fills
 *     ("Relógio da fonte" on the time field). A field set to "Fonte" or "Relógio da fonte"
 *     is read as its binding (bindingFormValue.ts), or gets that binding's message; one
 *     set to "Cadastro" as its entity reference (entityReferenceFormValue.ts); a list
 *     field set to "Lista dos cadastros" as its entity list (entityListFormValue.ts).
 *  2. What was typed is read as data. A number, an mm:ss time or a date that cannot be
 *     read gets its message. A list of texts is read line by line.
 *  3. The blank rules: a required field left blank is refused (also a required text: an
 *     empty required text counts as missing, which is stricter than JSON Schema); an
 *     optional field left blank or cleared with "limpar" is cleared.
 *  4. Every value that got this far is checked against the manifest's limits with the
 *     Zod schema built from the same JSON Schema.
 * The server's Ajv check stays the authority; see zodSchemaFromDataSchema.ts.
 */
import type {
  BindingFieldValue,
  EntityFieldValue,
  EntityListFieldValue,
  EventFieldValue,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import {
  canFieldBeBoundToASource,
  canFieldTakeTheWholeClock,
  listClockFieldKeysFilledByTheWholeClock,
} from './bindingChoices';
import { emptySchemaFormBindingValue, readBindingFromSchemaFormValue } from './bindingFormValue';
import { readEntityListOfFormField } from './entityListFormValue';
import {
  canFieldReadTheEntityLibrary,
  emptySchemaFormEntityReferenceValue,
  readEntityReferenceFromSchemaFormValue,
} from './entityReferenceFormValue';
import { canFieldBeFilledByAnEvent, readEventFieldOfFormField } from './eventFieldFormValue';
import {
  type DataValueOfSchemaFormField,
  type ProblemReadingFormValue,
  readDataValueFromFormValue,
} from './fieldValueConversion';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';
import { buildZodSchemaFromDataSchema } from './zodSchemaFromDataSchema';

/** One field of a form that passed the check, as the commands need it. */
export type CheckedSchemaFormField =
  | { key: string; outcome: 'value'; value: DataValueOfSchemaFormField }
  | { key: string; outcome: 'cleared' }
  | { key: string; outcome: 'takeTime' }
  | { key: string; outcome: 'binding'; binding: BindingFieldValue }
  | { key: string; outcome: 'entity'; reference: EntityFieldValue }
  | { key: string; outcome: 'entityList'; list: EntityListFieldValue }
  | { key: string; outcome: 'filledByTheWholeClock' }
  | { key: string; outcome: 'eventField'; eventField: EventFieldValue };

/** The pt-BR message for one wrong field. */
export type SchemaFormFieldMessage = {
  fieldKey: string;
  message: string;
};

/** What checking a form gives: every editable field as data, or every wrong field's message. */
export type SchemaFormCheck =
  | { status: 'valid'; checkedFields: CheckedSchemaFormField[] }
  | { status: 'invalid'; fieldMessages: SchemaFormFieldMessage[] };

const fieldErrors = ptBR.schemaForm.fieldErrors;

/** The message for a typed text that could not be read as data. */
function writeMessageForUnreadableValue(problem: ProblemReadingFormValue, fieldLabel: string) {
  switch (problem) {
    case 'notANumber':
      return fieldErrors.notANumber(fieldLabel);
    case 'notMinutesAndSeconds':
      return fieldErrors.notMinutesAndSeconds(fieldLabel);
    case 'notADateAndTime':
      return fieldErrors.notADateAndTime(fieldLabel);
  }
}

/**
 * Checks the form's values against the description they were built from. Every wrong
 * field is reported at once, each with its first problem only. Fields the form cannot
 * edit (the read-only JSON boxes) are neither checked nor listed.
 */
export function checkSchemaFormValues(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): SchemaFormCheck {
  const checkedFields: CheckedSchemaFormField[] = [];
  const fieldMessages: SchemaFormFieldMessage[] = [];
  const dataPairsToCheckAgainstTheLimits: Array<[string, DataValueOfSchemaFormField]> = [];
  const keysFilledByTheWholeClock = listKeysFilledByAChosenWholeClock(description, formValues);

  for (const field of description.fields) {
    // A list field set to "Lista dos cadastros" reads every sponsor or every slot
    // (BAJAOVRLAY-46); the choice is the list's kind, which the offer keeps fitting.
    const isListFieldReadingTheLibrary =
      field.control === 'unsupported' &&
      readOwnValueOfRecord(formValues.kinds, field.key) === 'entityList';
    if (isListFieldReadingTheLibrary) {
      const chosenListType = readOwnValueOfRecord(formValues.entityLists ?? {}, field.key);
      const list = readEntityListOfFormField(description.dataSchema, field.key, chosenListType);
      if (list !== undefined) {
        checkedFields.push({ key: field.key, outcome: 'entityList', list });
      }
      continue;
    }
    // A field the form cannot edit is not checked, unless it reads a source (a list).
    const isListFieldReadingASource =
      field.control === 'unsupported' &&
      readOwnValueOfRecord(formValues.kinds, field.key) === 'binding';
    if (field.control === 'unsupported' && !isListFieldReadingASource) {
      continue;
    }
    // First: the whole clock fills these whatever their own kind (the moment field starts
    // as "filled at the take" in a new form, and must not stamp over the source's moment).
    if (keysFilledByTheWholeClock.includes(field.key)) {
      checkedFields.push({ key: field.key, outcome: 'filledByTheWholeClock' });
      continue;
    }
    const kind = readOwnValueOfRecord(formValues.kinds, field.key);
    if (field.offersTakeTime && kind === 'takeTime') {
      checkedFields.push({ key: field.key, outcome: 'takeTime' });
      continue;
    }
    const isBound =
      kind === 'binding' && canFieldBeBoundToASource(description.dataSchema, field.key);
    const isWholeClock =
      kind === 'wholeClock' && canFieldTakeTheWholeClock(description.dataSchema, field.key);
    if (isBound || isWholeClock) {
      const bindingValue =
        readOwnValueOfRecord(formValues.bindings, field.key) ?? emptySchemaFormBindingValue;
      const bindingRead = readBindingFromSchemaFormValue(
        field,
        bindingValue,
        description.dataSchema,
        isWholeClock,
      );
      if (bindingRead.status === 'problem') {
        fieldMessages.push({ fieldKey: field.key, message: bindingRead.message });
      } else {
        checkedFields.push({ key: field.key, outcome: 'binding', binding: bindingRead.binding });
      }
      continue;
    }

    // "Evento" (BAJAOVRLAY-44): the payload field chosen, or the message asking for one.
    if (kind === 'eventField' && canFieldBeFilledByAnEvent(description.dataSchema, field.key)) {
      const eventFieldRead = readEventFieldOfFormField(field, formValues, description.dataSchema);
      if (eventFieldRead.status === 'problem') {
        fieldMessages.push({ fieldKey: field.key, message: eventFieldRead.message });
      } else {
        const eventField = eventFieldRead.eventField;
        checkedFields.push({ key: field.key, outcome: 'eventField', eventField });
      }
      continue;
    }
    if (kind === 'entity' && canFieldReadTheEntityLibrary(description.dataSchema, field.key)) {
      const referenceValue =
        readOwnValueOfRecord(formValues.entityReferences ?? {}, field.key) ??
        emptySchemaFormEntityReferenceValue;
      const referenceRead = readEntityReferenceFromSchemaFormValue(
        field,
        referenceValue,
        description.dataSchema,
      );
      if (referenceRead.status === 'problem') {
        fieldMessages.push({ fieldKey: field.key, message: referenceRead.message });
      } else {
        checkedFields.push({
          key: field.key,
          outcome: 'entity',
          reference: referenceRead.reference,
        });
      }
      continue;
    }

    const formValue = readOwnValueOfRecord(formValues.values, field.key);
    const dataValueRead = readDataValueFromFormValue(field, formValue);
    if (dataValueRead.status === 'unreadable') {
      const message = writeMessageForUnreadableValue(dataValueRead.problem, field.label);
      fieldMessages.push({ fieldKey: field.key, message });
      continue;
    }
    if (dataValueRead.status === 'blank') {
      if (field.isRequired) {
        fieldMessages.push({ fieldKey: field.key, message: fieldErrors.required(field.label) });
      } else {
        checkedFields.push({ key: field.key, outcome: 'cleared' });
      }
      continue;
    }
    checkedFields.push({ key: field.key, outcome: 'value', value: dataValueRead.value });
    dataPairsToCheckAgainstTheLimits.push([field.key, dataValueRead.value]);
  }

  // Only the fields that have a value are handed to Zod, so it also reports every
  // required field that is not among them (blank, unreadable, or filled at the take).
  // Those were dealt with above; only a message about a field that was handed over counts.
  const keysHandedToZod = dataPairsToCheckAgainstTheLimits.map(([fieldKey]) => fieldKey);
  const limitsCheck = buildZodSchemaFromDataSchema(description.dataSchema).safeParse(
    Object.fromEntries(dataPairsToCheckAgainstTheLimits),
  );
  if (!limitsCheck.success) {
    for (const issue of limitsCheck.error.issues) {
      const fieldKey = issue.path[0];
      const isAboutAFieldHandedOver =
        typeof fieldKey === 'string' && keysHandedToZod.includes(fieldKey);
      const hasMessageAlready = fieldMessages.some((entry) => entry.fieldKey === fieldKey);
      if (typeof fieldKey === 'string' && isAboutAFieldHandedOver && !hasMessageAlready) {
        fieldMessages.push({ fieldKey, message: issue.message });
      }
    }
  }

  if (fieldMessages.length > 0) {
    return { status: 'invalid', fieldMessages };
  }
  return { status: 'valid', checkedFields };
}

/**
 * The three clock fields "Relógio da fonte" fills while it is the time field's kind, or
 * none: their own values are kept in the form, unchecked and unsent.
 */
export function listKeysFilledByAChosenWholeClock(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): string[] {
  const isWholeClockChosen = description.fields.some(
    (field) =>
      readOwnValueOfRecord(formValues.kinds, field.key) === 'wholeClock' &&
      canFieldTakeTheWholeClock(description.dataSchema, field.key),
  );
  return isWholeClockChosen ? listClockFieldKeysFilledByTheWholeClock(description.dataSchema) : [];
}

/**
 * The checked fields of a form that must already be valid, for the builders of commands:
 * they are called only after react-hook-form let the press through.
 * Throws when the form is not valid, because building a command from it would send
 * something the operator never saw checked.
 */
export function readCheckedFieldsOfValidSchemaForm(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): CheckedSchemaFormField[] {
  const check = checkSchemaFormValues(description, formValues);
  if (check.status === 'invalid') {
    throw new Error(
      'A command can only be built from schema form values that passed checkSchemaFormValues',
    );
  }
  return check.checkedFields;
}
