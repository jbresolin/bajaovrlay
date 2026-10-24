/**
 * Whether an item that reads the entity library can be taken now, and why not, so a
 * rundown row or a shortcut button says so before the press, as for a source
 * (features/bindings/itemTakeReadiness.ts). The same rules as the server's take: a record
 * that is not in the library refuses always, an absent attribute refuses a required
 * field and leaves an optional one out. The reason is written as the server writes it,
 * the field's title first.
 */
import {
  type EntityLibrary,
  type Graphic,
  type Item,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';

import { readRequiredFieldKeys, readTitleOfField } from '@/features/bindings/dataSchemaFieldFacts';
import { ptBR } from '@/i18n/ptBR';

/** Says whether an item reads any field from the entity library. */
export function doesItemReadTheLibrary(item: Item): boolean {
  return Object.values(item.fields).some((fieldValue) => fieldValue.kind === 'entity');
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
    if (fieldValue.kind !== 'entity') {
      continue;
    }
    const resolution = resolveEntityReferenceAgainstLibrary(fieldValue, library);
    const isRefused =
      resolution.status === 'unresolvable' ||
      (resolution.status === 'valueAbsent' && requiredFieldKeys.includes(fieldKey));
    if (isRefused) {
      return ptBR.bindings.formErrors.aboutField(
        readTitleOfField(dataSchema, fieldKey),
        resolution.problem,
      );
    }
  }
  return undefined;
}
