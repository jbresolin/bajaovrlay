import type { RenameOutputCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { refuseUnknownOutput } from '../outputRefusals.js';

/**
 * renameOutput: gives an output a new name, program included; its id never changes,
 * because an OBS scene holds it in its URL. The name it already has changes nothing.
 */
export function reduceRenameOutput(
  slices: SlicesChangedByCommands,
  command: RenameOutputCommand,
): ReducerOutcome {
  const output = slices.outputs.find((candidate) => candidate.outputId === command.outputId);
  if (output === undefined) {
    return { status: 'refused', error: refuseUnknownOutput(command.outputId) };
  }
  if (output.name === command.name) {
    return { status: 'applied', slices };
  }
  const outputsAfter = slices.outputs.map((candidate) =>
    candidate === output ? { ...candidate, name: command.name } : candidate,
  );
  return { status: 'applied', slices: { ...slices, outputs: outputsAfter } };
}
