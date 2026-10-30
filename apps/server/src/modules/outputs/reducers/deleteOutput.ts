import {
  type DeleteOutputCommand,
  listLayersOfOutputBottomToTop,
  programOutputId,
} from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  refuseDeleteOfOutputWithLayers,
  refuseDeleteOfProgram,
  refuseUnknownOutput,
} from '../outputRefusals.js';

/**
 * deleteOutput: removes an output and moves the ones after it up by one, so the orders
 * stay 0, 1, 2, ... with no gap. Refused, in this order, for an output that does not
 * exist, for program (OBS's main source; it always exists), and for an output that still
 * has layers (named): the operator deletes them or moves them first, so no layer is ever
 * left without an output.
 */
export function reduceDeleteOutput(
  slices: SlicesChangedByCommands,
  command: DeleteOutputCommand,
): ReducerOutcome {
  const output = slices.outputs.find((candidate) => candidate.outputId === command.outputId);
  if (output === undefined) {
    return { status: 'refused', error: refuseUnknownOutput(command.outputId) };
  }
  if (output.outputId === programOutputId) {
    return { status: 'refused', error: refuseDeleteOfProgram(output) };
  }
  const layersOfTheOutput = listLayersOfOutputBottomToTop(slices.layers, output.outputId);
  if (layersOfTheOutput.length > 0) {
    return { status: 'refused', error: refuseDeleteOfOutputWithLayers(output, layersOfTheOutput) };
  }

  const outputsKeptInOrder = slices.outputs
    .filter((candidate) => candidate !== output)
    .sort((earlierOutput, laterOutput) => earlierOutput.order - laterOutput.order);
  const outputsAfter = outputsKeptInOrder.map((keptOutput, position) =>
    keptOutput.order === position ? keptOutput : { ...keptOutput, order: position },
  );
  return { status: 'applied', slices: { ...slices, outputs: outputsAfter } };
}
