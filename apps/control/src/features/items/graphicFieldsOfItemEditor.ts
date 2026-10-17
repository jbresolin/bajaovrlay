/**
 * The part of the item editor that depends on the graphic: the fields generated from the
 * graphic's manifest, and the values they open with. Everything here is decided at one
 * moment, when the editor starts drawing a graphic, and kept together so the fields on
 * screen, their rules and their values always belong to the same graphic.
 */
import type { Graphic, Item, ItemFields } from '@bajaovrlay/shared';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
  describeSchemaFormFromDataSchema,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';

import type { ItemEditorPrefill } from './ItemEditorTargetProvider';

/** The generated fields of one graphic, filled for the item the editor has open. */
export type GraphicFieldsOfItemEditor = {
  /** What the graphic's manifest says about each field. */
  description: SchemaFormDescription;
  /** What the generated form opens with. */
  formValues: SchemaFormValues;
  /**
   * Labels of the fields that are shown with their starting value because what was
   * handed in for them could not be shown. Always empty when starting from the defaults.
   */
  labelsOfFieldsThatCouldNotBeRead: string[];
};

/**
 * Generates the fields of `graphic` and fills them:
 * - with `fieldsToShow` null (a new item) from the manifest's defaults, with a
 *   wall-clock field left for the server to stamp at the take;
 * - otherwise with those fields, each in the kind it is stored in: what a stored item
 *   stores, or the prefill of a new item opened by "Salvar como item".
 * What could go wrong: the fields of a stored item must be filled from the item as it was
 * when the editor opened, because "what changed" is judged against that same item.
 */
export function fillGraphicFieldsOfItemEditor(
  graphic: Graphic,
  fieldsToShow: ItemFields | null,
): GraphicFieldsOfItemEditor {
  const description = describeSchemaFormFromDataSchema(graphic.manifest.schema);

  if (fieldsToShow === null) {
    return {
      description,
      formValues: buildEmptySchemaFormValues(description),
      labelsOfFieldsThatCouldNotBeRead: [],
    };
  }

  const valuesReadFromTheFields = buildSchemaFormValuesFromItemFields(description, fieldsToShow);
  return {
    description,
    formValues: valuesReadFromTheFields.formValues,
    labelsOfFieldsThatCouldNotBeRead: valuesReadFromTheFields.labelsOfFieldsThatCouldNotBeRead,
  };
}

/**
 * The fields the graphic's form of the editor opens with, for the graphic chosen now:
 * a stored item's own fields; for a new item, the prefill's fields while the prefilled
 * graphic is the one chosen; otherwise null, meaning the manifest's defaults. A prefill
 * belongs to its graphic only: choose another graphic and its fields start from defaults.
 */
export function chooseFieldsToShowInGraphicForm(
  chosenGraphicId: string,
  storedItem: Item | null,
  prefill: ItemEditorPrefill | null,
): ItemFields | null {
  if (storedItem !== null) {
    return storedItem.fields;
  }
  const isPrefilledGraphicChosen = prefill !== null && prefill.graphicId === chosenGraphicId;
  if (isPrefilledGraphicChosen) {
    return prefill.fields;
  }
  return null;
}
