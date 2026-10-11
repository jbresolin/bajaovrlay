import type { Instance, TakeGraphicCommand } from '@bajaovrlay/shared';

import {
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownLayer,
} from '../commandRefusals.js';
import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from '../graphicDataPreparation.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * takeGraphic: puts a new instance of the graphic on the layer and output, replacing
 * the instance already there (one per layer per output). Other layers and the other
 * output are left alone. The data the instance holds is the command's data prepared in
 * two steps: a field sent as `null` is left out (it was cleared in the form), then each
 * field named in `takeTimeFieldKeys` gets the moment of this command in milliseconds.
 * Refused, before anything changes, if the layer or the graphic does not exist or if
 * the prepared data breaks the graphic's manifest schema.
 */
export function reduceTakeGraphic(
  slices: SlicesChangedByCommands,
  command: TakeGraphicCommand,
  context: ReducerContext,
): ReducerOutcome {
  const layerExists = slices.layers.some((layer) => layer.id === command.layerId);
  if (!layerExists) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const graphic = slices.graphics.find(
    (registeredGraphic) => registeredGraphic.id === command.graphicId,
  );
  if (graphic === undefined) {
    return { status: 'refused', error: refuseUnknownGraphic(command.graphicId) };
  }

  // Null first, stamp second: a field that is both sent as null and named for stamping
  // ends up stamped, because the stamp is the more specific request of the two.
  const { fieldsWithAValue } = separateClearedFieldsFromData(command.data);
  const dataForTheGraphic = stampFieldsWithMomentOfTheCommand(
    fieldsWithAValue,
    command.takeTimeFieldKeys,
    context.now,
  );

  // Checked here rather than left to the graphic: by the time a graphic refuses its
  // data in the renderer, the instance it replaced has already left the screen. The
  // prepared data is what is checked, so leaving out a cleared REQUIRED field is
  // refused as a missing field.
  const problemInData = findProblemInGraphicData(graphic, dataForTheGraphic);
  if (problemInData !== undefined) {
    return { status: 'refused', error: refuseInvalidGraphicData(graphic.id, problemInData) };
  }

  // A new instance is `loading` until a renderer reports what happened to it on
  // screen; reportInstanceStatus then moves it to `on-air` or `failed`.
  const newInstance: Instance = {
    id: context.newInstanceId,
    layerId: command.layerId,
    graphicId: command.graphicId,
    target: command.target,
    resolvedData: dataForTheGraphic,
    currentStep: 0,
    status: 'loading',
    takenAt: context.now,
  };
  const instancesKept = slices.instances.filter((instance) => {
    const isOnTheSameLayerAndOutput =
      instance.layerId === command.layerId && instance.target === command.target;
    return !isOnTheSameLayerAndOutput;
  });

  return {
    status: 'applied',
    slices: { ...slices, instances: [...instancesKept, newInstance] },
  };
}
