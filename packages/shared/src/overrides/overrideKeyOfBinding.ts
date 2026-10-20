import type { BindingFieldValue } from '../bindings/bindingFieldValue.js';
import { entryOfCarPathPrefix } from '../dataShapes/bindablePaths.js';
import type { DataSnapshotShapes } from '../dataSources/dataSnapshot.js';
import { OverridableCarFieldSchema, OverridableSessionFieldSchema } from './override.js';
import type { OverrideKey } from './overrideKey.js';

/** "entries.3.teamName": the place and the field of a path into a list. */
const placePathPattern = /^entries\.(\d+)\.([A-Za-z]+)$/;

/**
 * The correction a bound field can take ("Corrigir valor da fonte…"), or undefined when
 * no correction reaches what it reads. A session path is a session correction; a path
 * into the positions or the standings is a correction of the car read there: the car the
 * binding names (a car chosen by number), or the car at that place in the snapshot now,
 * because a correction belongs to the car and follows it when the places change. The
 * clock, laps, times, gaps, ranks and whole lists have none (override.ts says why).
 */
export function findOverrideKeyOfBinding(
  binding: BindingFieldValue,
  shapes: DataSnapshotShapes | undefined,
): OverrideKey | undefined {
  if (binding.shapeKey === 'session') {
    const sessionField = OverridableSessionFieldSchema.safeParse(binding.path);
    return sessionField.success
      ? { sourceId: binding.sourceId, scope: 'session', field: sessionField.data }
      : undefined;
  }
  if (binding.shapeKey !== 'positions' && binding.shapeKey !== 'standings') {
    return undefined;
  }

  const carAndField = findCarAndFieldOfPath(binding, shapes);
  if (carAndField === undefined) {
    return undefined;
  }
  const carField = OverridableCarFieldSchema.safeParse(carAndField.field);
  if (!carField.success) {
    return undefined;
  }
  return {
    sourceId: binding.sourceId,
    scope: 'car',
    carNumber: carAndField.carNumber,
    field: carField.data,
  };
}

/** The car and the field a path into a list reads, or undefined (a whole list, no car). */
function findCarAndFieldOfPath(
  binding: BindingFieldValue,
  shapes: DataSnapshotShapes | undefined,
): { carNumber: number; field: string } | undefined {
  if (binding.path.startsWith(entryOfCarPathPrefix)) {
    return binding.carNumber === undefined
      ? undefined
      : { carNumber: binding.carNumber, field: binding.path.slice(entryOfCarPathPrefix.length) };
  }
  const placeMatch = placePathPattern.exec(binding.path);
  if (placeMatch === null) {
    return undefined;
  }
  const entries =
    binding.shapeKey === 'positions' ? shapes?.positions?.entries : shapes?.standings?.entries;
  const entryAtThePlace = entries?.[Number(placeMatch[1])];
  if (entryAtThePlace === undefined) {
    return undefined;
  }
  return { carNumber: entryAtThePlace.carNumber, field: placeMatch[2] ?? '' };
}
