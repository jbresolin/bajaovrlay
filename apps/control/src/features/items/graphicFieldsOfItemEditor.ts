/**
 * The part of the item editor that depends on the graphic: the fields generated from the
 * graphic's manifest, and the values they open with. Everything here is decided at one
 * moment, when the editor starts drawing a graphic, and kept together so the fields on
 * screen, their rules and their values always belong to the same graphic.
 */
import {
  type CarGroup,
  type Graphic,
  type Item,
  type ItemFields,
  readCarGroupsOfManifest,
} from '@bajaovrlay/shared';

import {
  buildCarGroupWaysAtOpening,
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
  buildSuggestedBindingsForNewItem,
  describeSchemaFormFromDataSchema,
  type SchemaFormDescription,
  type SchemaFormValues,
  type SourcesForSuggestedBindings,
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
  /**
   * The graphic's car groups (BAJAOVRLAY-66), each drawn as one car picker; empty for a
   * graphic that declares none, or whose groups the shared check refuses (the server's
   * boot log says why), which then shows its fields one by one as before.
   */
  carGroups: CarGroup[];
};

/** The page's sources when the editor has none to judge a manifest's suggestion by. */
const noSourcesForSuggestedBindings: SourcesForSuggestedBindings = {
  dataSources: [],
  dataSnapshots: [],
};

/**
 * Generates the fields of `graphic` and fills them:
 * - with `fieldsToShow` null (a new item) from the manifest's defaults, with a
 *   wall-clock field left for the server to stamp at the take, and a field whose
 *   manifest suggests a "Fonte" pre-filled with it when exactly one enabled source of
 *   `sources` produces that shape (suggestedBindingsOfDataSchema.ts);
 * - otherwise with those fields, each in the kind it is stored in: what a stored item
 *   stores, or the prefill of a new item opened by "Salvar como item".
 * What could go wrong: the fields of a stored item must be filled from the item as it was
 * when the editor opened, because "what changed" is judged against that same item.
 */
export function fillGraphicFieldsOfItemEditor(
  graphic: Graphic,
  fieldsToShow: ItemFields | null,
  sources: SourcesForSuggestedBindings = noSourcesForSuggestedBindings,
): GraphicFieldsOfItemEditor {
  const description = describeSchemaFormFromDataSchema(graphic.manifest.schema);
  const carGroupsReading = readCarGroupsOfManifest(graphic.manifest);
  const carGroups = carGroupsReading.status === 'groups' ? carGroupsReading.carGroups : [];

  if (fieldsToShow === null) {
    const suggestedBindings = buildSuggestedBindingsForNewItem(graphic.manifest.schema, sources);
    const formValues = buildEmptySchemaFormValues(description, suggestedBindings);
    return {
      description,
      formValues: addCarGroupWays(formValues, carGroups),
      labelsOfFieldsThatCouldNotBeRead: [],
      carGroups,
    };
  }

  const valuesReadFromTheFields = buildSchemaFormValuesFromItemFields(description, fieldsToShow);
  return {
    description,
    formValues: addCarGroupWays(valuesReadFromTheFields.formValues, carGroups),
    labelsOfFieldsThatCouldNotBeRead: valuesReadFromTheFields.labelsOfFieldsThatCouldNotBeRead,
    carGroups,
  };
}

/**
 * The form's values with the way each car group opens, read from its fields as they are:
 * an item stored field by field on one car opens grouped, one on different cars separate.
 * A graphic with no group gets no `carGroupWays` at all, so its form is exactly as before.
 */
function addCarGroupWays(formValues: SchemaFormValues, carGroups: CarGroup[]): SchemaFormValues {
  if (carGroups.length === 0) {
    return formValues;
  }
  return { ...formValues, carGroupWays: buildCarGroupWaysAtOpening(carGroups, formValues) };
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
