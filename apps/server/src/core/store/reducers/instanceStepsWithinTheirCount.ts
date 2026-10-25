import { readStepCountOfInstance } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from './reducerTypes.js';

/**
 * Puts every instance whose current step is past its step count on its last step
 * (BAJAOVRLAY-25). The bracket counts its steps from its rounds, so a live refresh, an
 * operator's update or a correction can leave it on a step it no longer has; Camadas would
 * read "Passo 6 de 3" and the renderer would sit on a step that does not exist. The renderer
 * plays the lower step like any other (a goto back, with the new data first). A graphic of a
 * fixed count never needs it. Run by reduceCommand after every command that changed the
 * instances; the same slices come back when no step moved.
 */
export function keepCurrentStepsWithinTheirStepCount(
  slices: SlicesChangedByCommands,
): SlicesChangedByCommands {
  let hasAnyStepMoved = false;
  const instancesAfter = slices.instances.map((instance) => {
    const graphic = slices.graphics.find((candidate) => candidate.id === instance.graphicId);
    const lastStep = readStepCountOfInstance(instance, graphic) - 1;
    if (instance.currentStep <= lastStep) {
      return instance;
    }
    hasAnyStepMoved = true;
    return { ...instance, currentStep: lastStep };
  });
  if (!hasAnyStepMoved) {
    return slices;
  }
  return { ...slices, instances: instancesAfter };
}
