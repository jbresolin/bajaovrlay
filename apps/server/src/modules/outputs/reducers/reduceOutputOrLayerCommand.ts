import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceCreateLayer } from './createLayer.js';
import { reduceCreateOutput } from './createOutput.js';
import { reduceDeleteLayer } from './deleteLayer.js';
import { reduceDeleteOutput } from './deleteOutput.js';
import { reduceMoveLayerToOutput } from './moveLayerToOutput.js';
import { reduceRenameOutput } from './renameOutput.js';
import { reduceReorderLayers } from './reorderLayers.js';
import { reduceReorderOutputs } from './reorderOutputs.js';
import { reduceUpdateLayer } from './updateLayer.js';

/** The nine commands of the outputs module, one reducer file each. */
export type OutputOrLayerCommand = Extract<
  Command,
  {
    type:
      | 'createOutput'
      | 'renameOutput'
      | 'deleteOutput'
      | 'reorderOutputs'
      | 'createLayer'
      | 'updateLayer'
      | 'moveLayerToOutput'
      | 'reorderLayers'
      | 'deleteLayer';
  }
>;

/** Sends an output or layer command to its reducer; core's reduceCommand calls this. */
export function reduceOutputOrLayerCommand(
  slices: SlicesChangedByCommands,
  command: OutputOrLayerCommand,
): ReducerOutcome {
  switch (command.type) {
    case 'createOutput':
      return reduceCreateOutput(slices, command);
    case 'renameOutput':
      return reduceRenameOutput(slices, command);
    case 'deleteOutput':
      return reduceDeleteOutput(slices, command);
    case 'reorderOutputs':
      return reduceReorderOutputs(slices, command);
    case 'createLayer':
      return reduceCreateLayer(slices, command);
    case 'updateLayer':
      return reduceUpdateLayer(slices, command);
    case 'moveLayerToOutput':
      return reduceMoveLayerToOutput(slices, command);
    case 'reorderLayers':
      return reduceReorderLayers(slices, command);
    case 'deleteLayer':
      return reduceDeleteLayer(slices, command);
  }
}
