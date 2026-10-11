import type { Instance, UpdateInstanceDataCommand } from '@bajaovrlay/shared';

import {
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownInstance,
} from '../commandRefusals.js';
import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from '../graphicDataPreparation.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateInstanceData: changes the instance's current data field by field (top-level
 * fields only; a field holding an object is replaced whole) and keeps the instance's
 * id, which is what makes the renderer update the graphic in place instead of taking
 * it off and on again. In this order: a field sent as `null` is taken off the data;
 * each field named in `takeTimeFieldKeys` gets the moment of this command in
 * milliseconds; every other field sent replaces the one on air. Refused if the instance
 * is not there, or if the resulting data breaks the graphic's manifest schema (taking
 * off a required field does).
 */
export function reduceUpdateInstanceData(
  slices: SlicesChangedByCommands,
  command: UpdateInstanceDataCommand,
  context: ReducerContext,
): ReducerOutcome {
  const instanceToUpdate = slices.instances.find((instance) => instance.id === command.instanceId);
  if (instanceToUpdate === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }
  const dataOnAir = instanceToUpdate.resolvedData;

  // Null first, stamp second: a field that is both sent as null and named for stamping
  // ends up stamped, because the stamp is the more specific request of the two.
  const { keysOfClearedFields, fieldsWithAValue } = separateClearedFieldsFromData(command.data);
  const fieldsToWrite = stampFieldsWithMomentOfTheCommand(
    fieldsWithAValue,
    command.takeTimeFieldKeys,
    context.now,
  );
  const keysToTakeOffAir = keysOfClearedFields.filter((clearedKey) => {
    const isOnAir = Object.hasOwn(dataOnAir, clearedKey);
    const isWrittenAnyway = Object.hasOwn(fieldsToWrite, clearedKey);
    return isOnAir && !isWrittenAnyway;
  });

  // Nothing to write and nothing on air to take off (no field sent at all, or only
  // nulls for fields that are not on air) means nothing to change: hand back the same
  // slices, so nothing is saved, logged or broadcast.
  const hasNothingToChange =
    Object.keys(fieldsToWrite).length === 0 && keysToTakeOffAir.length === 0;
  if (hasNothingToChange) {
    return { status: 'applied', slices };
  }

  // The schema lives in the graphics slice, so this reducer reads no file. A graphic
  // can be missing here if its package was removed while its instance stayed on air
  // across a restart; without its schema the new data cannot be checked.
  const graphic = slices.graphics.find(
    (registeredGraphic) => registeredGraphic.id === instanceToUpdate.graphicId,
  );
  if (graphic === undefined) {
    return { status: 'refused', error: refuseUnknownGraphic(instanceToUpdate.graphicId) };
  }

  // The whole result is checked, not only the fields sent: the graphic receives the
  // whole object, a field that is valid alone can be invalid next to the others, and a
  // required field that was just taken off is found missing here.
  const keysAndValuesKeptFromAir = Object.entries(dataOnAir).filter(
    ([fieldKey]) => !keysToTakeOffAir.includes(fieldKey),
  );
  const dataAfterUpdate = {
    ...Object.fromEntries(keysAndValuesKeptFromAir),
    ...fieldsToWrite,
  };
  const problemInData = findProblemInGraphicData(graphic, dataAfterUpdate);
  if (problemInData !== undefined) {
    return { status: 'refused', error: refuseInvalidGraphicData(graphic.id, problemInData) };
  }

  // The status is left alone: an update says nothing about what the renderer managed
  // to show, so a `failed` instance stays failed until it is cleared or replaced.
  const updatedInstance: Instance = { ...instanceToUpdate, resolvedData: dataAfterUpdate };
  const instancesAfterUpdate = slices.instances.map((instance) =>
    instance.id === command.instanceId ? updatedInstance : instance,
  );
  return { status: 'applied', slices: { ...slices, instances: instancesAfterUpdate } };
}
