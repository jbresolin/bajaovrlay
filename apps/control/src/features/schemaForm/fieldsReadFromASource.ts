/**
 * Which fields of a generated form read a data source now ("Fonte", "Relógio da fonte",
 * and the clock fields the whole clock fills) or the entity library ("Cadastro",
 * BAJAOVRLAY-19), and whether those choices changed since the form opened. "Atualizar no
 * ar" sends typed values only: such a choice reaches the air at the next take, which
 * reads the item (gate 2 of PR #18).
 */
import { areJsonValuesEqual } from '@bajaovrlay/shared';

import { listKeysFilledByAChosenWholeClock } from './checkSchemaFormValues';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormFieldKind, SchemaFormValues } from './schemaFormValues';

/** Whether a field of this kind reads a source or the library rather than a typed value. */
function isKindReadFromASource(kind: SchemaFormFieldKind | undefined): boolean {
  return kind === 'binding' || kind === 'wholeClock' || kind === 'entity';
}

/**
 * The keys the form reads from a source now: each field set to "Fonte" or "Relógio da
 * fonte", and the three clock fields the whole clock fills beside it.
 */
export function listFieldKeysReadFromASource(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): string[] {
  const keysOfSourceKinds = description.fields
    .map((field) => field.key)
    .filter((fieldKey) => isKindReadFromASource(readOwnValueOfRecord(formValues.kinds, fieldKey)));
  const keysFilledByTheWholeClock = listKeysFilledByAChosenWholeClock(description, formValues);
  return [...keysOfSourceKinds, ...keysFilledByTheWholeClock];
}

/**
 * Whether any source choice differs from the form as it opened: a field switched to or
 * from a source, or a source field now pointing elsewhere (source, path, car, live or
 * frozen, transform). A typed change alone answers false.
 */
export function hasSourceChoiceChangedSinceOpened(
  description: SchemaFormDescription,
  formValuesNow: SchemaFormValues,
  formValuesAsOpened: SchemaFormValues,
): boolean {
  return description.fields.some((field) => {
    const kindNow = readOwnValueOfRecord(formValuesNow.kinds, field.key);
    const kindAsOpened = readOwnValueOfRecord(formValuesAsOpened.kinds, field.key);
    const isReadFromASourceNow = isKindReadFromASource(kindNow);
    const wasReadFromASource = isKindReadFromASource(kindAsOpened);
    if (kindNow !== kindAsOpened) {
      return isReadFromASourceNow || wasReadFromASource;
    }
    if (!isReadFromASourceNow) {
      return false;
    }
    if (kindNow === 'entity') {
      const referenceNow = readOwnValueOfRecord(formValuesNow.entityReferences ?? {}, field.key);
      const referenceAsOpened = readOwnValueOfRecord(
        formValuesAsOpened.entityReferences ?? {},
        field.key,
      );
      return !areJsonValuesEqual(referenceNow, referenceAsOpened);
    }
    const bindingNow = readOwnValueOfRecord(formValuesNow.bindings, field.key);
    const bindingAsOpened = readOwnValueOfRecord(formValuesAsOpened.bindings, field.key);
    return !areJsonValuesEqual(bindingNow, bindingAsOpened);
  });
}
