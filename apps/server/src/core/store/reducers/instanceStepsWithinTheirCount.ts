import { type Graphic, type Instance, readStepCountOfInstance } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from './reducerTypes.js';

/** An instance brought back to its last step: which, from what step, to what step. */
export type StepBroughtBack = { instanceId: string; stepBefore: number; stepAfter: number };

/**
 * Puts every instance whose current step is past its step count on its last step
 * (BAJAOVRLAY-25), and says which it moved. The bracket counts its steps from its rounds,
 * so a live refresh, an operator's update or a correction can leave it on a step it no
 * longer has, and so can a graphic rebuilt with fewer steps between two boots; Camadas
 * would read "Passo 6 de 3" and the renderer would sit on a step that does not exist. The
 * renderer plays the lower step like any other (a goto back, with the new data first). A
 * graphic of a fixed count never needs it. The same list comes back when no step moved.
 */
export function bringStepsWithinTheirCount(
  instances: Instance[],
  graphics: Graphic[],
): { instances: Instance[]; stepsBroughtBack: StepBroughtBack[] } {
  const stepsBroughtBack: StepBroughtBack[] = [];
  const instancesAfter = instances.map((instance) => {
    const graphic = graphics.find((candidate) => candidate.id === instance.graphicId);
    const lastStep = readStepCountOfInstance(instance, graphic) - 1;
    if (instance.currentStep <= lastStep) {
      return instance;
    }
    stepsBroughtBack.push({
      instanceId: instance.id,
      stepBefore: instance.currentStep,
      stepAfter: lastStep,
    });
    return { ...instance, currentStep: lastStep };
  });
  if (stepsBroughtBack.length === 0) {
    return { instances, stepsBroughtBack };
  }
  return { instances: instancesAfter, stepsBroughtBack };
}

/**
 * The same over a command's slices: run by reduceCommand after every command that changed
 * the instances. The same slices come back when no step moved; the store logs the moves.
 */
export function keepCurrentStepsWithinTheirStepCount(slices: SlicesChangedByCommands): {
  slices: SlicesChangedByCommands;
  stepsBroughtBack: StepBroughtBack[];
} {
  const brought = bringStepsWithinTheirCount(slices.instances, slices.graphics);
  if (brought.stepsBroughtBack.length === 0) {
    return { slices, stepsBroughtBack: [] };
  }
  return {
    slices: { ...slices, instances: brought.instances },
    stepsBroughtBack: brought.stepsBroughtBack,
  };
}
