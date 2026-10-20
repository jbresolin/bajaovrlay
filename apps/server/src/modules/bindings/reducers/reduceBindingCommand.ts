import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceClearOverride } from './clearOverride.js';
import { reduceRefreshBoundInstanceData } from './refreshBoundInstanceData.js';
import { reduceSetOverride } from './setOverride.js';

/** The commands of the bindings module (the refresh and the overrides), one reducer file each. */
export type BindingCommand = Extract<
  Command,
  { type: 'refreshBoundInstanceData' | 'setOverride' | 'clearOverride' }
>;

/** Sends a binding command to its reducer; core's reduceCommand calls this. */
export function reduceBindingCommand(
  slices: SlicesChangedByCommands,
  command: BindingCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'refreshBoundInstanceData':
      return reduceRefreshBoundInstanceData(slices, command, context);
    case 'setOverride':
      return reduceSetOverride(slices, command, context);
    case 'clearOverride':
      return reduceClearOverride(slices, command);
  }
}
