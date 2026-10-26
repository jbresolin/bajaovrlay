/**
 * What a field of a generated form may read from a data source: the bindable paths that
 * fit it (directly, or through a binding transform), and for each the transforms that
 * make it fit. Read from the graphic's data schema with the shared fit rules, so the
 * item editor offers exactly what the server accepts when the item is saved.
 */
import {
  type BindableValueType,
  type DataShapeKey,
  DataShapeKeySchema,
  findClockFieldKeysByRoleInDataSchema,
  findTransform,
  listBindablePathsOfShape,
  listTransformsOfFamily,
  listValueTypesThatFitDataSchemaField,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import {
  findKeptBindingPathChoices,
  keepBindingPathChoices,
} from './bindingPathChoicesKeptPerSchema';

/** One path a field may read, as its dropdown offers it. */
export type BindingPathChoice = {
  /** "positions:entries.0.teamName": the shape and the path, the dropdown's value. */
  pathKey: string;
  shapeKey: DataShapeKey;
  path: string;
  /** "Posições › 1º colocado › Equipe". */
  label: string;
  valueType: BindableValueType;
  /** True for the paths under "Carro escolhido pelo número": a car number goes with them. */
  isCarChosenByNumber: boolean;
  /** Whether the path fits the field with no transform ("Nenhuma" is offered). */
  fitsWithoutTransform: boolean;
  /** The binding transforms that read this path and give a type the field takes. */
  transformIdsThatFit: string[];
};

/** The whole session clock's key: offered apart, as "Relógio da fonte". */
export const wholeClockPathKey = `session:${wholeClockBindingPath}`;

/** Joins a shape and a path into the key a dropdown holds. */
export function buildBindingPathKey(shapeKey: DataShapeKey, path: string): string {
  return `${shapeKey}:${path}`;
}

/** Reads a dropdown's key back into its shape and path, or undefined for one not offered. */
export function readBindingPathKey(
  pathKey: string,
): { shapeKey: DataShapeKey; path: string } | undefined {
  const separatorIndex = pathKey.indexOf(':');
  const shapeKey = DataShapeKeySchema.safeParse(pathKey.slice(0, separatorIndex));
  if (separatorIndex <= 0 || !shapeKey.success) {
    return undefined;
  }
  return { shapeKey: shapeKey.data, path: pathKey.slice(separatorIndex + 1) };
}

/**
 * Lists the paths a field may read, shape by shape in the order the picker shows them
 * (session, positions, standings, brackets): every path whose type fits the field
 * directly or through a binding transform. The whole clock is left out: it is offered
 * as its own kind, "Relógio da fonte". Worked out once per schema object and field, and
 * handed back from bindingPathChoicesKeptPerSchema.ts after that: every field asks at
 * every draw (BAJAOVRLAY-45).
 */
export function listBindingPathChoicesOfField(
  dataSchema: unknown,
  fieldKey: string,
): readonly BindingPathChoice[] {
  // A schema that is not an object (a graphic without one) has nothing to key on.
  if (typeof dataSchema !== 'object' || dataSchema === null) {
    return workOutBindingPathChoicesOfField(dataSchema, fieldKey);
  }
  const keptChoices = findKeptBindingPathChoices(dataSchema, fieldKey);
  if (keptChoices !== undefined) {
    return keptChoices;
  }
  // Frozen, the list and each choice, as the shapes' own paths are: a kept list is handed
  // to every draw, and a caller that changed it would spoil it for the next.
  const frozenChoices = workOutBindingPathChoicesOfField(dataSchema, fieldKey).map((choice) =>
    Object.freeze(choice),
  );
  const choices = Object.freeze(frozenChoices);
  keepBindingPathChoices(dataSchema, fieldKey, choices);
  return choices;
}

/** Works the choices of listBindingPathChoicesOfField out, from the schema and the shapes. */
function workOutBindingPathChoicesOfField(
  dataSchema: unknown,
  fieldKey: string,
): BindingPathChoice[] {
  const typesTheFieldTakes = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  const choices: BindingPathChoice[] = [];
  for (const shapeKey of DataShapeKeySchema.options) {
    for (const bindablePath of listBindablePathsOfShape(shapeKey)) {
      if (bindablePath.valueType === 'clockGroup') {
        continue;
      }
      const fitsWithoutTransform = typesTheFieldTakes.includes(bindablePath.valueType);
      const transformIdsThatFit = listTransformIdsThatFit(
        bindablePath.valueType,
        typesTheFieldTakes,
      );
      if (fitsWithoutTransform || transformIdsThatFit.length > 0) {
        choices.push({
          pathKey: buildBindingPathKey(shapeKey, bindablePath.path),
          shapeKey,
          path: bindablePath.path,
          label: bindablePath.label,
          valueType: bindablePath.valueType,
          isCarChosenByNumber: bindablePath.isCarChosenByNumber,
          fitsWithoutTransform,
          transformIdsThatFit,
        });
      }
    }
  }
  return choices;
}

/** The binding transforms that read this type and give one the field takes. */
function listTransformIdsThatFit(
  valueTypeOfThePath: BindableValueType,
  typesTheFieldTakes: BindableValueType[],
): string[] {
  const transformIds: string[] = [];
  for (const transform of listTransformsOfFamily('binding')) {
    if (transform.family !== 'binding' || !transform.valueTypesRead.includes(valueTypeOfThePath)) {
      continue;
    }
    const typeGiven =
      transform.valueTypeGiven === 'sameAsTheValueRead'
        ? valueTypeOfThePath
        : transform.valueTypeGiven;
    if (typesTheFieldTakes.includes(typeGiven)) {
      transformIds.push(transform.id);
    }
  }
  return transformIds;
}

/**
 * The binding transforms that may follow the first one chosen on a path (BAJAOVRLAY-47):
 * those that read what the first gives and give a type the field takes, the first itself
 * left out. The paths offered stay those that fit with at most one transform; the second
 * only shapes further a value that already fits (withTeamLogos after topN on the podium).
 */
export function listSecondTransformIdsThatFit(
  dataSchema: unknown,
  fieldKey: string,
  valueTypeOfThePath: BindableValueType,
  firstTransformId: string,
): string[] {
  const firstTransform = findTransform(firstTransformId);
  if (firstTransform?.family !== 'binding') {
    return [];
  }
  const valueTypeAfterTheFirst =
    firstTransform.valueTypeGiven === 'sameAsTheValueRead'
      ? valueTypeOfThePath
      : firstTransform.valueTypeGiven;
  const typesTheFieldTakes = listValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  const transformIdsThatFit = listTransformIdsThatFit(valueTypeAfterTheFirst, typesTheFieldTakes);
  return transformIdsThatFit.filter((transformId) => transformId !== firstTransformId);
}

/** Whether "Fonte" is offered for a field: some bindable path fits it. */
export function canFieldBeBoundToASource(dataSchema: unknown, fieldKey: string): boolean {
  return listBindingPathChoicesOfField(dataSchema, fieldKey).length > 0;
}

/**
 * Whether "Relógio da fonte" is offered for a field: it is the time field (role
 * clockTime) of a graphic that marks all four clock roles. Named by role, never by a
 * graphic, so no code here belongs to the race clock.
 */
export function canFieldTakeTheWholeClock(dataSchema: unknown, fieldKey: string): boolean {
  return findClockFieldKeysByRoleInDataSchema(dataSchema)?.clockTime === fieldKey;
}

/**
 * The keys of the three clock fields the whole clock fills besides the time field, or
 * none for a graphic without the four roles.
 */
export function listClockFieldKeysFilledByTheWholeClock(dataSchema: unknown): string[] {
  const clockFieldKeys = findClockFieldKeysByRoleInDataSchema(dataSchema);
  if (clockFieldKeys === undefined) {
    return [];
  }
  return [clockFieldKeys.wallClock, clockFieldKeys.clockRunning, clockFieldKeys.clockMode];
}
