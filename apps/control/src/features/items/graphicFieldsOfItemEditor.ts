/**
 * The part of the item editor that depends on the graphic: the fields generated from the
 * graphic's manifest, and the values they open with. Everything here is decided at one
 * moment, when the editor starts drawing a graphic, and kept together so the fields on
 * screen, their rules and their values always belong to the same graphic.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
  describeSchemaFormFromDataSchema,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';

/** The generated fields of one graphic, filled for the item the editor has open. */
export type GraphicFieldsOfItemEditor = {
  /** What the graphic's manifest says about each field. */
  description: SchemaFormDescription;
  /** What the generated form opens with. */
  formValues: SchemaFormValues;
  /**
   * Labels of the fields of a stored item that are shown with their starting value
   * because what the item stores could not be shown. Always empty for a new item.
   */
  labelsOfFieldsThatCouldNotBeRead: string[];
};

/**
 * Generates the fields of `graphic` and fills them for the item the editor has open:
 * - a new item (`storedItem` null) starts from the manifest's defaults, with a
 *   wall-clock field left for the server to stamp at the take;
 * - a stored item shows what it stores, each field in the kind it is stored in.
 * What could go wrong: the fields of a stored item must be filled from the item as it was
 * when the editor opened, because "what changed" is judged against that same item.
 */
export function fillGraphicFieldsOfItemEditor(
  graphic: Graphic,
  storedItem: Item | null,
): GraphicFieldsOfItemEditor {
  const description = describeSchemaFormFromDataSchema(graphic.manifest.schema);

  if (storedItem === null) {
    return {
      description,
      formValues: buildEmptySchemaFormValues(description),
      labelsOfFieldsThatCouldNotBeRead: [],
    };
  }

  const valuesReadFromTheItem = buildSchemaFormValuesFromItemFields(description, storedItem.fields);
  return {
    description,
    formValues: valuesReadFromTheItem.formValues,
    labelsOfFieldsThatCouldNotBeRead: valuesReadFromTheItem.labelsOfFieldsThatCouldNotBeRead,
  };
}
