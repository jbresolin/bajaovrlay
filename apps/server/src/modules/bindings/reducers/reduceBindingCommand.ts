import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceRefreshBoundInstanceData } from './refreshBoundInstanceData.js';

/** The commands of the bindings module, one reducer file each. */
export type BindingCommand = Extract<Command, { type: 'refreshBoundInstanceData' }>;

/** Sends a binding command to its reducer; core's reduceCommand calls this. */
export function reduceBindingCommand(
  slices: SlicesChangedByCommands,
  command: BindingCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'refreshBoundInstanceData':
      return reduceRefreshBoundInstanceData(slices, command, context);
  }
}
