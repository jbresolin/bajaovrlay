import type { Instance, UpdateInstanceDataCommand } from '@bajaovrlay/shared';

import {
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownInstance,
} from '../commandRefusals.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateInstanceData: lays the command's fields over the instance's current data
 * (top-level fields only; a field holding an object is replaced whole) and keeps the
 * instance's id, which is what makes the renderer update the graphic in place instead
 * of taking it off and on again. Refused if the instance is not there, or if the
 * resulting data breaks the graphic's manifest schema.
 */
export function reduceUpdateInstanceData(
  slices: SlicesChangedByCommands,
  command: UpdateInstanceDataCommand,
): ReducerOutcome {
  const instanceToUpdate = slices.instances.find((instance) => instance.id === command.instanceId);
  if (instanceToUpdate === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }

  // No field sent means nothing to change: hand back the same slices, so nothing is
  // saved or broadcast.
  const hasNoFieldToChange = Object.keys(command.data).length === 0;
  if (hasNoFieldToChange) {
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
  // whole object, and a field that is valid alone can be invalid next to the others.
  const dataAfterUpdate = { ...instanceToUpdate.resolvedData, ...command.data };
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
