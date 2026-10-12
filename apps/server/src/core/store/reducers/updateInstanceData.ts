import { isDeepStrictEqual } from 'node:util';

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
 * off a required field does). An update that leaves the data exactly as it is on air
 * hands back the same slices.
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

  const keysAndValuesKeptFromAir = Object.entries(dataOnAir).filter(
    ([fieldKey]) => !keysToTakeOffAir.includes(fieldKey),
  );
  const dataAfterUpdate = {
    ...Object.fromEntries(keysAndValuesKeptFromAir),
    ...fieldsToWrite,
  };

  // Compared by content: no field sent at all, only nulls for fields that are not on
  // air, or values equal to the ones on air (an "Atualizar" pressed on an untouched
  // form) all leave the data as it is. Hand back the same slices, so nothing is saved,
  // logged or broadcast. A stamped field holds the moment of this command, which differs
  // from the one on air, so a stamp is a change.
  // Deliberate trade-off: this comes before the schema check, so re-sending what is on
  // air is answered ok even for an instance whose graphic is no longer registered.
  const leavesTheDataOnAirAsItIs = isDeepStrictEqual(dataAfterUpdate, dataOnAir);
  if (leavesTheDataOnAirAsItIs) {
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
