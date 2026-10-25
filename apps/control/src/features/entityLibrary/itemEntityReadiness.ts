/**
 * Whether an item that reads the entity library can be taken now, and why not, so a
 * rundown row or a shortcut button says so before the press, as for a source
 * (features/bindings/itemTakeReadiness.ts). The same rules as the server's take: a record
 * that is not in the library refuses always, an absent attribute refuses a required
 * field and leaves an optional one out; a whole list (BAJAOVRLAY-46, "Lista dos
 * cadastros") that is empty now refuses a required field and leaves an optional one out.
 * The reason is written as the server writes it, the field's title first.
 */
import {
  type EntityLibrary,
  type FieldValue,
  type Graphic,
  type Item,
  resolveEntityListAgainstLibrary,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';

import { readRequiredFieldKeys, readTitleOfField } from '@/features/bindings/dataSchemaFieldFacts';
import { ptBR } from '@/i18n/ptBR';

/** Says whether an item reads any field from the entity library, a record or a whole list. */
export function doesItemReadTheLibrary(item: Item): boolean {
  return Object.values(item.fields).some(
    (fieldValue) => fieldValue.kind === 'entity' || fieldValue.kind === 'entityList',
  );
}

/**
 * Why one field that reads the library would refuse the take now, or undefined: the
 * server's sentence without the field's title.
 */
function findWhyFieldCannotBeReadNow(
  fieldValue: FieldValue,
  isRequired: boolean,
  library: EntityLibrary,
): string | undefined {
  if (fieldValue.kind === 'entity') {
    const resolution = resolveEntityReferenceAgainstLibrary(fieldValue, library);
    if (resolution.status === 'unresolvable') {
      return resolution.problem;
    }
    if (resolution.status === 'valueAbsent' && isRequired) {
      return resolution.problem;
    }
    return undefined;
  }
  if (fieldValue.kind === 'entityList') {
    const resolution = resolveEntityListAgainstLibrary(fieldValue, library);
    if (resolution.status === 'valueAbsent' && isRequired) {
      return resolution.problem;
    }
    return undefined;
  }
  return undefined;
}

/** The first reason the item cannot be taken now because of the library, or undefined. */
export function findWhyItemCannotBeTakenNowFromTheLibrary(
  item: Item,
  graphic: Graphic | undefined,
  library: EntityLibrary,
): string | undefined {
  const dataSchema = graphic?.manifest.schema;
  const requiredFieldKeys = readRequiredFieldKeys(dataSchema);
  for (const [fieldKey, fieldValue] of Object.entries(item.fields)) {
    const isRequired = requiredFieldKeys.includes(fieldKey);
    const problem = findWhyFieldCannotBeReadNow(fieldValue, isRequired, library);
    if (problem !== undefined) {
      return ptBR.bindings.formErrors.aboutField(readTitleOfField(dataSchema, fieldKey), problem);
    }
  }
  return undefined;
}
