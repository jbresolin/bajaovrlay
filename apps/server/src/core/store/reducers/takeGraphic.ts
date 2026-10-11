import type { Instance, TakeGraphicCommand } from '@bajaovrlay/shared';

import {
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownLayer,
} from '../commandRefusals.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * takeGraphic: puts a new instance of the graphic on the layer and output, replacing
 * the instance already there (one per layer per output). Other layers and the other
 * output are left alone. Refused, before anything changes, if the layer or the graphic
 * does not exist or if the data breaks the graphic's manifest schema.
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
  // Checked here rather than left to the graphic: by the time a graphic refuses its
  // data in the renderer, the instance it replaced has already left the screen.
  const problemInData = findProblemInGraphicData(graphic, command.data);
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
    resolvedData: command.data,
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
