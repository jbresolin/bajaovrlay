/**
 * A field's "Cadastro" choices as the form holds them, and how they become the entity
 * reference an item stores (BAJAOVRLAY-19). Plain texts, so react-hook-form copies and
 * compares them like any value; reading them is where the pt-BR messages come from.
 */
import {
  type EntityFieldValue,
  type EntityType,
  findProblemInEntityReferenceForDataSchemaField,
  listEntityValueTypesThatFitDataSchemaField,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';

/**
 * What "Cadastro" holds while the operator chooses:
 * - `entityType`: the kind of record, '' for none yet;
 * - `recordKey`: the record's key as text, a team's car number ("7") or an id, '' for none;
 * - `attribute`: what of the record to show ("teamName", "logoUrl"), '' for none.
 */
export type SchemaFormEntityReferenceValue = {
  entityType: EntityType | '';
  recordKey: string;
  attribute: string;
};

/** "Cadastro" with nothing chosen yet, as every field starts. */
export const emptySchemaFormEntityReferenceValue: SchemaFormEntityReferenceValue = {
  entityType: '',
  recordKey: '',
  attribute: '',
};

/** What reading the choices gives: the reference to store, or the message under the field. */
export type EntityReferenceReading =
  { status: 'reference'; reference: EntityFieldValue } | { status: 'problem'; message: string };

/** Whether "Cadastro" is offered on a field: some attribute of the library fits it. */
export function canFieldReadTheEntityLibrary(dataSchema: unknown, fieldKey: string): boolean {
  return listEntityValueTypesThatFitDataSchemaField(dataSchema, fieldKey).length > 0;
}

/** The choices of a stored reference, to fill the form ("Editar item"). */
export function buildSchemaFormEntityReferenceValueFromReference(
  reference: EntityFieldValue,
): SchemaFormEntityReferenceValue {
  return {
    entityType: reference.entityType,
    recordKey: readKeyOfReference(reference),
    attribute: reference.attribute,
  };
}

/** A reference's record key as text: the car number of a team, the id of the others. */
export function readKeyOfReference(reference: EntityFieldValue): string {
  switch (reference.entityType) {
    case 'team':
      return String(reference.carNumber);
    case 'person':
      return reference.personId;
    case 'sponsor':
      return reference.sponsorId;
    case 'scheduleSlot':
      return reference.slotId;
  }
}

/**
 * Reads the choices into the reference the item stores, or the first thing missing, in
 * the order the controls ask: the kind, the record, the attribute; then the shared fit
 * check (an image only on an image field), as the server's save runs it. Each message
 * starts with the field's label.
 */
export function readEntityReferenceFromSchemaFormValue(
  field: SchemaFormFieldDescription,
  value: SchemaFormEntityReferenceValue,
  dataSchema: unknown,
): EntityReferenceReading {
  const problems = ptBR.entityLibrary.editor.formErrors;
  const aboutField = (problem: string) => ptBR.bindings.formErrors.aboutField(field.label, problem);
  if (value.entityType === '') {
    return { status: 'problem', message: aboutField(problems.entityTypeMissing) };
  }
  if (value.recordKey === '') {
    return { status: 'problem', message: aboutField(problems.recordMissing) };
  }
  if (value.attribute === '') {
    return { status: 'problem', message: aboutField(problems.attributeMissing) };
  }
  const reference = buildReference(value.entityType, value.recordKey, value.attribute);
  const problemOfTheFit = findProblemInEntityReferenceForDataSchemaField(
    reference,
    dataSchema,
    field.key,
  );
  if (problemOfTheFit !== undefined) {
    return { status: 'problem', message: aboutField(problemOfTheFit) };
  }
  return { status: 'reference', reference };
}

/** The reference of a kind, a key and an attribute, the key a number for a team. */
function buildReference(
  entityType: EntityType,
  recordKey: string,
  attribute: string,
): EntityFieldValue {
  switch (entityType) {
    case 'team':
      return { kind: 'entity', entityType: 'team', carNumber: Number(recordKey), attribute };
    case 'person':
      return { kind: 'entity', entityType: 'person', personId: recordKey, attribute };
    case 'sponsor':
      return { kind: 'entity', entityType: 'sponsor', sponsorId: recordKey, attribute };
    case 'scheduleSlot':
      return { kind: 'entity', entityType: 'scheduleSlot', slotId: recordKey, attribute };
  }
}
