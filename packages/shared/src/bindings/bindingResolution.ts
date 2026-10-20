import {
  type BindablePath,
  entryOfCarPathPrefix,
  findBindablePath,
} from '../dataShapes/bindablePaths.js';
import { ptBRDataShapes } from '../dataShapes/ptBRDataShapes.js';
import { areJsonValuesEqual } from '../dataSources/areJsonValuesEqual.js';
import type { DataSnapshot, DataSnapshotShapes } from '../dataSources/dataSnapshot.js';
import type { DataSource } from '../dataSources/dataSource.js';
import { applyOverridesToSnapshotShapes } from '../overrides/applyOverrides.js';
import type { Override } from '../overrides/override.js';
import type { JsonValue } from '../transforms/transform.js';
import { findTransform } from '../transforms/transformRegistry.js';
import type { BindingFieldValue } from './bindingFieldValue.js';
import { findProblemInBinding } from './bindingProblems.js';
import { ptBRBindings } from './ptBRBindings.js';

/**
 * What a binding is read against, all plain data from the slices: the sources (for their
 * labels), each source's last good snapshot, and the operator's overrides. Nothing else
 * is read, the clock included, so the server and the item editor get the same answer
 * from the same slices.
 */
export type SourcesForBindings = {
  dataSources: DataSource[];
  dataSnapshots: DataSnapshot[];
  overrides: Override[];
};

/**
 * What reading one binding gives:
 * - `resolved`: the value, transformed, and whether an override changed what was read
 *   (shown as a badge wherever the value appears);
 * - `valueAbsent`: the snapshot does not hold the value (a field the source does not know,
 *   a car it does not list); the take leaves an optional field out and refuses a
 *   required one, and a live refresh takes an optional field off air;
 * - `unresolvable`: the binding cannot be read at all (no such source, no data yet, a
 *   shape the source does not send, a transform that refuses the value).
 * Each problem is a pt-BR sentence the server puts the field's title before.
 */
export type BindingResolution =
  | { status: 'resolved'; value: JsonValue; isOverridden: boolean }
  | { status: 'valueAbsent'; problem: string }
  | { status: 'unresolvable'; problem: string };

/** What reading a path in one shape found: a value, or nothing (and whether the car was missing). */
type ValueReadAtPath =
  { isFound: true; value: unknown } | { isFound: false; isCarMissing: boolean };

/**
 * Reads the value one binding gives now: the source's last good snapshot (a stale one
 * too: staleness is a badge, never a refusal, concept §5.4), with the operator's
 * overrides of that source laid over it, at the binding's path, through its transform.
 * Pure: it never throws and reads nothing but what it is given.
 */
export function resolveBindingAgainstSources(
  binding: BindingFieldValue,
  sources: SourcesForBindings,
): BindingResolution {
  const problems = ptBRBindings.resolutionProblems;
  const dataSource = sources.dataSources.find((candidate) => candidate.id === binding.sourceId);
  if (dataSource === undefined) {
    return { status: 'unresolvable', problem: problems.sourceNotFound(binding.sourceId) };
  }
  const snapshot = sources.dataSnapshots.find(
    (candidate) => candidate.sourceId === binding.sourceId,
  );
  if (snapshot === undefined) {
    return { status: 'unresolvable', problem: problems.noDataYet(dataSource.label) };
  }
  if (snapshot.shapes[binding.shapeKey] === undefined) {
    const shapeName = ptBRDataShapes.shapeNames[binding.shapeKey];
    return { status: 'unresolvable', problem: problems.shapeNotSent(dataSource.label, shapeName) };
  }
  // A stored item may predate a change of the path list; the save refuses such a binding.
  const problemOfTheBinding = findProblemInBinding(binding);
  const bindablePath = findBindablePath(binding.shapeKey, binding.path);
  if (problemOfTheBinding !== undefined || bindablePath === undefined) {
    return { status: 'unresolvable', problem: problemOfTheBinding ?? binding.path };
  }

  const correctedShapes = applyOverridesToSnapshotShapes(
    binding.sourceId,
    snapshot.shapes,
    sources.overrides,
  );
  const readingWithOverrides = readValueAtBindablePath(correctedShapes, binding, bindablePath);
  if (!readingWithOverrides.isFound) {
    const problem = readingWithOverrides.isCarMissing
      ? problems.carNotListed(dataSource.label, binding.carNumber ?? 0)
      : problems.valueNotInSnapshot(dataSource.label, bindablePath.label);
    return { status: 'valueAbsent', problem };
  }
  const readingAsTheSourceSent = readValueAtBindablePath(snapshot.shapes, binding, bindablePath);
  const isOverridden =
    !readingAsTheSourceSent.isFound ||
    !areJsonValuesEqual(readingAsTheSourceSent.value, readingWithOverrides.value);

  return applyTransformOfBinding(binding, readingWithOverrides.value as JsonValue, isOverridden);
}

/** Runs the binding's transform, if any, over the value read. */
function applyTransformOfBinding(
  binding: BindingFieldValue,
  valueRead: JsonValue,
  isOverridden: boolean,
): BindingResolution {
  if (binding.transformId === undefined) {
    return { status: 'resolved', value: valueRead, isOverridden };
  }
  // findProblemInBinding already checked that the transform exists in the binding family.
  const transform = findTransform(binding.transformId);
  if (transform === undefined) {
    return { status: 'unresolvable', problem: binding.transformId };
  }
  const transformResult = transform.apply(valueRead, binding.transformParameters);
  if (!transformResult.ok) {
    return {
      status: 'unresolvable',
      problem: ptBRBindings.resolutionProblems.transformRefused(
        transform.label,
        transformResult.reason,
      ),
    };
  }
  return { status: 'resolved', value: transformResult.value, isOverridden };
}

/** Says whether a value read from a shape is a plain object, so its fields can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a listed path in the shapes: a path under `entryOfCar.` reads the positions entry
 * of the binding's car, found by its number; any other path steps through objects by key
 * and through lists by index ("entries.0.teamName"). Nothing found, or a null, is "not
 * found": the shapes say "the source does not know" by leaving a field out.
 */
function readValueAtBindablePath(
  shapes: DataSnapshotShapes,
  binding: BindingFieldValue,
  bindablePath: BindablePath,
): ValueReadAtPath {
  const shape: unknown = shapes[binding.shapeKey];
  if (bindablePath.isCarChosenByNumber) {
    const entries = isPlainObject(shape) && Array.isArray(shape.entries) ? shape.entries : [];
    const entryOfTheCar: unknown = entries.find(
      (entry: unknown) => isPlainObject(entry) && entry.carNumber === binding.carNumber,
    );
    if (!isPlainObject(entryOfTheCar)) {
      return { isFound: false, isCarMissing: true };
    }
    const fieldName = binding.path.slice(entryOfCarPathPrefix.length);
    return readStepsFrom(entryOfTheCar, [fieldName]);
  }
  return readStepsFrom(shape, binding.path.split('.'));
}

/** Follows the steps of a path from a value, by key in an object and by index in a list. */
function readStepsFrom(startingValue: unknown, steps: string[]): ValueReadAtPath {
  let currentValue: unknown = startingValue;
  for (const step of steps) {
    if (Array.isArray(currentValue) && /^\d+$/.test(step)) {
      currentValue = currentValue[Number(step)];
    } else if (isPlainObject(currentValue) && Object.hasOwn(currentValue, step)) {
      currentValue = currentValue[step];
    } else {
      return { isFound: false, isCarMissing: false };
    }
  }
  if (currentValue === undefined || currentValue === null) {
    return { isFound: false, isCarMissing: false };
  }
  return { isFound: true, value: currentValue };
}
