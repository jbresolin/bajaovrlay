// The save check of item fields that read the entity library, run by createItem and
// updateItemFields beside the binding check (itemBindingFields.ts).
import {
  type CommandError,
  type EntityLibrary,
  findProblemInEntityReferenceForDataSchemaField,
  type Graphic,
  type ItemFields,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readTitleOfField } from './itemBindingFields.js';

/**
 * The refusal for the first entity reference among these fields that cannot be saved on
 * this graphic, or undefined when every one may be stored (or there is none). In order:
 * the attribute must exist for its kind of record and fit the field (the shared check
 * the item editor runs too), and the record must be in the library now. So a mistake is
 * heard while preparing the show, not at the take on air.
 * What could go wrong: it judges by the library of now. A record deleted after the save
 * is found missing at the take instead, which refuses that take, naming it.
 */
export function findRefusalOfEntityFieldsForGraphic(
  graphic: Graphic,
  fieldsInTheCommand: ItemFields,
  entities: EntityLibrary,
): CommandError | undefined {
  for (const [fieldKey, fieldValue] of Object.entries(fieldsInTheCommand)) {
    if (fieldValue.kind !== 'entity') {
      continue;
    }
    const fieldTitle = readTitleOfField(graphic, fieldKey);
    const problemOfTheField = findProblemInEntityReferenceForDataSchemaField(
      fieldValue,
      graphic.manifest.schema,
      fieldKey,
    );
    if (problemOfTheField !== undefined) {
      return refuseEntityReferenceOfField(fieldTitle, problemOfTheField);
    }
    // An absent optional attribute (no logo yet) may be saved: the take leaves it out.
    const resolution = resolveEntityReferenceAgainstLibrary(fieldValue, entities);
    if (resolution.status === 'unresolvable') {
      return refuseEntityReferenceOfField(fieldTitle, resolution.problem);
    }
  }
  return undefined;
}

/** The INVALID_ENTITY_REFERENCE refusal, the field's title before the sentence. */
function refuseEntityReferenceOfField(fieldTitle: string, sentence: string): CommandError {
  return {
    code: 'INVALID_ENTITY_REFERENCE',
    message: ptBR.bindingErrors.aboutField(fieldTitle, sentence),
  };
}
