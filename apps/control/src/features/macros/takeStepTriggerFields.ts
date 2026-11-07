/**
 * What a "Pôr item no ar" step needs to fill fields from the trigger (BAJAOVRLAY-48): the
 * fields of each item's graphic, by title, with the required ones marked, so the step can
 * offer "Dado do gatilho" for any of them and say which would stop the macro when the key
 * is missing. Pure; read from the item's graphic manifest as the server registered it.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';

import { isPlainRecord } from '@/features/schemaForm/plainRecord';

/** One field of an item's graphic, as a take step offers it. */
export type GraphicFieldOfTakeStep = { fieldKey: string; title: string; isRequired: boolean };

/**
 * The fields of each item's graphic, by item id, in the order the graphic's data schema
 * lists them; a field with no title is shown by its key. An item whose graphic is not
 * registered (its package not built) has no field to offer.
 */
export function listGraphicFieldsOfEachItem(
  items: Item[],
  graphics: Graphic[],
): Record<string, GraphicFieldOfTakeStep[]> {
  const fieldsOfEachItem: Record<string, GraphicFieldOfTakeStep[]> = {};
  for (const item of items) {
    const graphic = graphics.find((candidate) => candidate.id === item.graphicId);
    fieldsOfEachItem[item.id] = graphic === undefined ? [] : listFieldsOfGraphic(graphic);
  }
  return fieldsOfEachItem;
}

/** The fields of one graphic's data schema, with their titles and whether each is required. */
function listFieldsOfGraphic(graphic: Graphic): GraphicFieldOfTakeStep[] {
  const dataSchema: unknown = graphic.manifest.schema;
  if (!isPlainRecord(dataSchema) || !isPlainRecord(dataSchema.properties)) {
    return [];
  }
  const requiredFieldKeys = Array.isArray(dataSchema.required) ? dataSchema.required : [];
  return Object.entries(dataSchema.properties).map(([fieldKey, fieldSchema]) => {
    const title =
      isPlainRecord(fieldSchema) && typeof fieldSchema.title === 'string'
        ? fieldSchema.title
        : fieldKey;
    return { fieldKey, title, isRequired: requiredFieldKeys.includes(fieldKey) };
  });
}
