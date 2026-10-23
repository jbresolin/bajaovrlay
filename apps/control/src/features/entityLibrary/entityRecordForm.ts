import { type EntityType, ptBREntities } from '@bajaovrlay/shared';

import { readKeyFieldOfEntityType } from './entityCsvColumns';
import { type AnyEntityRecord, readSchemaOfEntityType } from './entityRecordsOfType';
import { readLocalDateTimeText, writeDateTimeInputValue } from './localDateTimeText';

/**
 * How one field of the form is typed: a line of text, a whole number, a choice from a
 * list (a state, a tier, a kind of session), a date and time, or an image (its media id,
 * set by the upload, EntityImageField.tsx).
 */
export type EntityFormFieldKind =
  'text' | 'wholeNumber' | 'state' | 'tier' | 'sessionKind' | 'localDateTime' | 'image';

/** One field of a tab's form: the record field it fills, its label, how it is typed. */
export type EntityFormField = {
  recordFieldKey: string;
  label: string;
  fieldKind: EntityFormFieldKind;
  isOptional: boolean;
};

/** What the form holds: the text of each field, by record field ("" for nothing). */
export type EntityFormValues = Record<string, string>;

/** What reading the form gives: the record to save, or a pt-BR sentence per wrong field. */
export type EntityFormReading =
  | { isValid: true; record: AnyEntityRecord }
  | { isValid: false; errorsByField: Record<string, string> };

const teamLabels = ptBREntities.teamFieldLabels;
const personLabels = ptBREntities.personFieldLabels;
const sponsorLabels = ptBREntities.sponsorFieldLabels;
const slotLabels = ptBREntities.scheduleSlotFieldLabels;

// The fields of each tab's form, in the order the form shows them. The ids of people,
// sponsors and slots are not fields: the page makes one for a new record.
const formFieldsByEntityType: Record<EntityType, EntityFormField[]> = {
  team: [
    {
      recordFieldKey: 'carNumber',
      label: teamLabels.carNumber,
      fieldKind: 'wholeNumber',
      isOptional: false,
    },
    {
      recordFieldKey: 'teamName',
      label: teamLabels.teamName,
      fieldKind: 'text',
      isOptional: false,
    },
    {
      recordFieldKey: 'schoolName',
      label: teamLabels.schoolName,
      fieldKind: 'text',
      isOptional: false,
    },
    {
      recordFieldKey: 'schoolFullName',
      label: teamLabels.schoolFullName,
      fieldKind: 'text',
      isOptional: true,
    },
    { recordFieldKey: 'city', label: teamLabels.city, fieldKind: 'text', isOptional: true },
    { recordFieldKey: 'state', label: teamLabels.state, fieldKind: 'state', isOptional: true },
    {
      recordFieldKey: 'logoMediaId',
      label: teamLabels.logoMediaId,
      fieldKind: 'image',
      isOptional: true,
    },
    {
      recordFieldKey: 'carPhotoMediaId',
      label: teamLabels.carPhotoMediaId,
      fieldKind: 'image',
      isOptional: true,
    },
  ],
  person: [
    { recordFieldKey: 'name', label: personLabels.name, fieldKind: 'text', isOptional: false },
    { recordFieldKey: 'role', label: personLabels.role, fieldKind: 'text', isOptional: false },
    {
      recordFieldKey: 'carNumber',
      label: personLabels.carNumber,
      fieldKind: 'wholeNumber',
      isOptional: true,
    },
    {
      recordFieldKey: 'photoMediaId',
      label: personLabels.photoMediaId,
      fieldKind: 'image',
      isOptional: true,
    },
  ],
  sponsor: [
    { recordFieldKey: 'name', label: sponsorLabels.name, fieldKind: 'text', isOptional: false },
    { recordFieldKey: 'tier', label: sponsorLabels.tier, fieldKind: 'tier', isOptional: false },
    {
      recordFieldKey: 'rollWeight',
      label: sponsorLabels.rollWeight,
      fieldKind: 'wholeNumber',
      isOptional: false,
    },
    {
      recordFieldKey: 'logoMediaId',
      label: sponsorLabels.logoMediaId,
      fieldKind: 'image',
      isOptional: true,
    },
  ],
  scheduleSlot: [
    {
      recordFieldKey: 'sessionName',
      label: slotLabels.sessionName,
      fieldKind: 'text',
      isOptional: false,
    },
    {
      recordFieldKey: 'sessionKind',
      label: slotLabels.sessionKind,
      fieldKind: 'sessionKind',
      isOptional: false,
    },
    {
      recordFieldKey: 'startsAtMs',
      label: slotLabels.startsAtMs,
      fieldKind: 'localDateTime',
      isOptional: false,
    },
    {
      recordFieldKey: 'endsAtMs',
      label: slotLabels.endsAtMs,
      fieldKind: 'localDateTime',
      isOptional: true,
    },
    { recordFieldKey: 'place', label: slotLabels.place, fieldKind: 'text', isOptional: true },
  ],
};

/** The fields of one tab's form, in the order it shows them. */
export function listFormFieldsOfEntityType(entityType: EntityType): EntityFormField[] {
  return formFieldsByEntityType[entityType];
}

/**
 * Fills the form from a stored record ("Editar"), or empty for a new one: every field as
 * the text its input holds (a moment as "2026-11-14T10:00"), "" for nothing.
 */
export function buildEntityFormValues(
  entityType: EntityType,
  record: AnyEntityRecord | null,
): EntityFormValues {
  const values: EntityFormValues = {};
  for (const field of listFormFieldsOfEntityType(entityType)) {
    const storedValue = (record as Record<string, unknown> | null)?.[field.recordFieldKey];
    if (storedValue === undefined) {
      values[field.recordFieldKey] = '';
    } else if (field.fieldKind === 'localDateTime' && typeof storedValue === 'number') {
      values[field.recordFieldKey] = writeDateTimeInputValue(storedValue);
    } else {
      values[field.recordFieldKey] = String(storedValue);
    }
  }
  return values;
}

/**
 * Reads what the form holds into the record to save: a whole number from its text, a
 * moment from the datetime input (this computer's clock), an empty field left out, then
 * the shared schema's check, its pt-BR sentences kept under the field each is about (the
 * first per field). The record keeps the key it was opened with, or a new id for a new
 * person, sponsor or slot (`makeNewId`); a team's key is its car number, a field.
 */
export function readEntityFormValues(
  entityType: EntityType,
  values: EntityFormValues,
  recordAsOpened: AnyEntityRecord | null,
  makeNewId: () => string,
): EntityFormReading {
  const fields: Record<string, unknown> = {};
  for (const field of listFormFieldsOfEntityType(entityType)) {
    const text = (values[field.recordFieldKey] ?? '').trim();
    if (text === '' && field.isOptional) {
      continue;
    }
    fields[field.recordFieldKey] = readFieldText(text, field);
  }
  const keyField = readKeyFieldOfEntityType(entityType);
  if (entityType !== 'team') {
    const keptKey = (recordAsOpened as Record<string, unknown> | null)?.[keyField];
    fields[keyField] = keptKey ?? makeNewId();
  }

  const check = readSchemaOfEntityType(entityType).safeParse(fields);
  if (check.success) {
    return { isValid: true, record: check.data };
  }
  const errorsByField: Record<string, string> = {};
  for (const issue of check.error.issues) {
    const fieldKey = String(issue.path[0] ?? '');
    errorsByField[fieldKey] ??= issue.message;
  }
  return { isValid: false, errorsByField };
}

/**
 * One field's text as the record wants it. Text that does not read as a number or a
 * moment is passed on as it is, so the schema refuses it with its own sentence; a
 * required field left empty is passed as "", which the schema calls "obrigatório".
 */
function readFieldText(text: string, field: EntityFormField): unknown {
  switch (field.fieldKind) {
    case 'wholeNumber':
      return /^\d+$/.test(text) ? Number(text) : text;
    case 'localDateTime':
      return readLocalDateTimeText(text) ?? text;
    case 'text':
    case 'state':
    case 'tier':
    case 'sessionKind':
    case 'image':
      return text;
  }
}
