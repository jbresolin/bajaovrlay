import type { CommandError, Graphic, ItemFields, TriggerFillOfTake } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import {
  listRequiredFieldKeysOfGraphic,
  readSchemaPropertyOfGraphic,
} from './graphicSchemaProperties.js';
import { readTitleOfField } from './itemBindingFields.js';

/** The item's fields with the trigger's values laid over them, or why the take is refused. */
export type ItemFieldsFilledByTheTrigger =
  | { status: 'filled'; fields: ItemFields }
  | { status: 'refused'; error: CommandError };

/**
 * Lays a macro step's trigger fields over the item's own (BAJAOVRLAY-48): each becomes a
 * literal of the value the trigger's data has at its key, so the take resolves it like any
 * typed value and the instance keeps it as plain data, frozen like a snapshot binding (no
 * binding is written for it, so no refresh can change it). A key the data lacks leaves an
 * optional field out (a literal null, which the take leaves out of the data) and refuses a
 * required one (TRIGGER_DATA_NOT_FILLED, the field's title first). A number going to a
 * field the graphic types as text is written as its text: a car number on a name line is
 * the plain case. Nothing else is converted; a text where the graphic wants a number is
 * refused by the take's schema check, as a typed value would be.
 */
export function fillItemFieldsFromTheTrigger(
  fields: ItemFields,
  triggerFill: TriggerFillOfTake,
  graphic: Graphic | undefined,
): ItemFieldsFilledByTheTrigger {
  const requiredFieldKeys = graphic === undefined ? [] : listRequiredFieldKeysOfGraphic(graphic);
  const fieldsAfter: ItemFields = { ...fields };
  for (const [fieldKey, triggerField] of Object.entries(triggerFill.fields)) {
    const value = triggerFill.data[triggerField.key];
    if (value === undefined) {
      if (requiredFieldKeys.includes(fieldKey)) {
        const fieldTitle = graphic === undefined ? fieldKey : readTitleOfField(graphic, fieldKey);
        return {
          status: 'refused',
          error: {
            code: 'TRIGGER_DATA_NOT_FILLED',
            message: ptBR.triggers.triggerDataNotFilled(fieldTitle, triggerField.key),
          },
        };
      }
      fieldsAfter[fieldKey] = { kind: 'literal', value: null };
      continue;
    }
    const isTextField = graphic !== undefined && isFieldTypedAsText(graphic, fieldKey);
    const valueForTheField = typeof value === 'number' && isTextField ? String(value) : value;
    fieldsAfter[fieldKey] = { kind: 'literal', value: valueForTheField };
  }
  return { status: 'filled', fields: fieldsAfter };
}

/** Whether the graphic's schema says this field is text (`type: "string"`). */
function isFieldTypedAsText(graphic: Graphic, fieldKey: string): boolean {
  return readSchemaPropertyOfGraphic(graphic, fieldKey)?.type === 'string';
}
