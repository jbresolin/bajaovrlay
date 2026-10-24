import {
  type CommandError,
  findProblemInEventFieldForField,
  type Graphic,
  type ItemFields,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readTitleOfField } from './itemBindingFields.js';

/**
 * The refusal for the first event field among these fields whose payload field does not
 * fit the graphic's field (INVALID_EVENT_FIELD, the field's title first), or undefined
 * when every one fits (or there is none). Run by createItem and updateItemFields beside
 * the bindings' check, so a mistake is heard while preparing the show (BAJAOVRLAY-44).
 */
export function findRefusalOfEventFieldsForGraphic(
  graphic: Graphic,
  fieldsInTheCommand: ItemFields,
): CommandError | undefined {
  for (const [fieldKey, fieldValue] of Object.entries(fieldsInTheCommand)) {
    if (fieldValue.kind !== 'eventField') {
      continue;
    }
    const problem = findProblemInEventFieldForField(fieldValue, graphic.manifest.schema, fieldKey);
    if (problem !== undefined) {
      return {
        code: 'INVALID_EVENT_FIELD',
        message: ptBR.eventErrors.invalidEventField(readTitleOfField(graphic, fieldKey), problem),
      };
    }
  }
  return undefined;
}
