import type { ReorderOutputsCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseOutputsNotAPermutation } from '../outputRefusals.js';

/**
 * reorderOutputs: gives each output its position in the list sent, from 0. The slice
 * keeps its own order; only the `order` fields change. Refused unless the list holds
 * every output exactly once. The same order changes nothing.
 */
export function reduceReorderOutputs(
  slices: SlicesChangedByCommands,
  command: ReorderOutputsCommand,
): ReducerOutcome {
  const isEveryOutputOnce =
    command.orderedOutputIds.length === slices.outputs.length &&
    new Set(command.orderedOutputIds).size === command.orderedOutputIds.length &&
    slices.outputs.every((output) => command.orderedOutputIds.includes(output.outputId));
  if (!isEveryOutputOnce) {
    return { status: 'refused', error: refuseOutputsNotAPermutation() };
  }

  const outputsAfter = slices.outputs.map((output) => {
    const newPosition = command.orderedOutputIds.indexOf(output.outputId);
    return output.order === newPosition ? output : { ...output, order: newPosition };
  });
  const hasAnyOutputMoved = outputsAfter.some((output, index) => output !== slices.outputs[index]);
  if (!hasAnyOutputMoved) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, outputs: outputsAfter } };
}
