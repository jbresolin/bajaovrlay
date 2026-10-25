import { findNextStepOfInstance, type NextOnLayerCommand } from '@bajaovrlay/shared';

import {
  refuseNextOnEmptyLayer,
  refuseNextWithoutAStep,
  refuseUnknownLayer,
} from '../commandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * nextOnLayer ("Próximo", BAJAOVRLAY-47): moves the instance on the layer's program output
 * to its next OGraf step, keeping its id, data and status, so the renderer plays that step
 * on the graphic already on screen. The preview output is never stepped. Refused when the
 * layer does not exist, when its program is empty, and when the graphic has no next step
 * (one step, or the last one): past the last step the operator takes it off with "Limpar",
 * deliberately, rather than the press doing it, since a press too many must never empty
 * the screen.
 */
export function reduceNextOnLayer(
  slices: SlicesChangedByCommands,
  command: NextOnLayerCommand,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const instanceOnAir = slices.instances.find(
    (instance) => instance.layerId === layer.id && instance.target === 'program',
  );
  if (instanceOnAir === undefined) {
    return { status: 'refused', error: refuseNextOnEmptyLayer(layer.name) };
  }
  const graphic = slices.graphics.find((candidate) => candidate.id === instanceOnAir.graphicId);
  const nextStep = findNextStepOfInstance(instanceOnAir, graphic);
  if (nextStep === undefined) {
    const graphicName = graphic?.manifest.name ?? instanceOnAir.graphicId;
    return { status: 'refused', error: refuseNextWithoutAStep(graphicName, layer.name) };
  }

  const instancesAfter = slices.instances.map((instance) =>
    instance.id === instanceOnAir.id ? { ...instance, currentStep: nextStep } : instance,
  );
  return { status: 'applied', slices: { ...slices, instances: instancesAfter } };
}
