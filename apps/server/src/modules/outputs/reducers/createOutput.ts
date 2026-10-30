import type { CreateOutputCommand, Output } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseOutputAlreadyThere } from '../outputRefusals.js';

/**
 * createOutput: adds an output after the last one, with no layer. Refused when another
 * output already has that id, since both would answer at the same address.
 */
export function reduceCreateOutput(
  slices: SlicesChangedByCommands,
  command: CreateOutputCommand,
): ReducerOutcome {
  const outputWithThatId = slices.outputs.find((output) => output.outputId === command.outputId);
  if (outputWithThatId !== undefined) {
    return { status: 'refused', error: refuseOutputAlreadyThere(outputWithThatId) };
  }
  // The outputs are always numbered 0..n-1, so their count is the position after the last.
  const newOutput: Output = {
    outputId: command.outputId,
    name: command.name,
    order: slices.outputs.length,
  };
  return { status: 'applied', slices: { ...slices, outputs: [...slices.outputs, newOutput] } };
}
