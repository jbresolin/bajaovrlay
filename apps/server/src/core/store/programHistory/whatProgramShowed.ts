import type { Instance, Item, ItemFields, ProgramHistoryShown } from '@bajaovrlay/shared';

// The kinds of item field an undo reads again, as a take does: a source's value, a record
// of the library, and the moment of the take. Every other field (a literal, an event's
// value) is fixed once on air, so its value on air is kept in the history instead.
const fieldKindsReadAgainAtTheUndo: ReadonlyArray<ItemFields[string]['kind']> = [
  'binding',
  'entity',
  'entityList',
  'takeTime',
];

/**
 * What a layer's program output shows, as the history remembers it: "vazio" for no
 * instance, or the instance's item with the values on air that do not read a source now
 * (see ProgramHistoryShownSchema). Undefined for an instance that names no item (taken by
 * hand before BAJAOVRLAY-37): nothing can take it again.
 */
export function describeWhatProgramShows(
  instanceOnProgram: Instance | undefined,
  items: Item[],
): ProgramHistoryShown | undefined {
  if (instanceOnProgram === undefined) {
    return { kind: 'empty' };
  }
  if (instanceOnProgram.itemId === undefined) {
    return undefined;
  }
  const item = items.find((candidate) => candidate.id === instanceOnProgram.itemId);
  const shown: ProgramHistoryShown = {
    kind: 'item',
    itemId: instanceOnProgram.itemId,
    graphicId: instanceOnProgram.graphicId,
    // An item deleted while on air stays on air ("item excluído"); its id is all there is.
    itemLabel: item?.label ?? instanceOnProgram.itemId,
    typedValues: collectTypedValuesOnAir(instanceOnProgram, item?.fields ?? {}),
  };
  if (instanceOnProgram.fieldsChangedOnAir !== undefined) {
    shown.fieldsChangedOnAir = instanceOnProgram.fieldsChangedOnAir;
  }
  if (instanceOnProgram.autoOutAfterMs !== undefined) {
    shown.autoOutAfterMs = instanceOnProgram.autoOutAfterMs;
  }
  return shown;
}

/**
 * The values on air that come back as they were: every field of the data and of the item,
 * except the item's bound, library and take-time fields, which the undo reads again. A
 * field changed on air is kept whatever its kind, since the operator typed it. A field of
 * the item that is not in the data had no value on air, and is kept as null ("no value"),
 * so the item's own value does not creep back in.
 */
function collectTypedValuesOnAir(
  instanceOnProgram: Instance,
  itemFields: ItemFields,
): Record<string, unknown> {
  const fieldsChangedOnAir = instanceOnProgram.fieldsChangedOnAir ?? [];
  const allFieldKeys = new Set([
    ...Object.keys(instanceOnProgram.resolvedData),
    ...Object.keys(itemFields),
  ]);
  const typedValues: Record<string, unknown> = {};
  for (const fieldKey of allFieldKeys) {
    const itemField = itemFields[fieldKey];
    const isReadAgain =
      itemField !== undefined && fieldKindsReadAgainAtTheUndo.includes(itemField.kind);
    const wasChangedOnAir = fieldsChangedOnAir.includes(fieldKey);
    if (isReadAgain && !wasChangedOnAir) {
      continue;
    }
    const isOnAir = Object.hasOwn(instanceOnProgram.resolvedData, fieldKey);
    typedValues[fieldKey] = isOnAir ? instanceOnProgram.resolvedData[fieldKey] : null;
  }
  return typedValues;
}

/** The instance on a layer's program output, or undefined when it shows nothing. */
export function findInstanceOnProgramOfLayer(
  instances: Instance[],
  layerId: string,
): Instance | undefined {
  return instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
}
