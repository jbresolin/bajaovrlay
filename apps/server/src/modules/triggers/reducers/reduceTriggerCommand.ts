import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceFireTrigger } from './fireTrigger.js';
import {
  reduceDismissTriggerFiring,
  reduceRestoreTriggerFiring,
  reduceRunTriggerFiring,
} from './triggerFiringAnswers.js';
import {
  reduceCreateTrigger,
  reduceDeleteTrigger,
  reduceSetTriggersPaused,
  reduceUpdateTrigger,
} from './triggerEditing.js';

/** The commands of triggers. */
export type TriggerCommand = Extract<
  Command,
  {
    type:
      | 'createTrigger'
      | 'updateTrigger'
      | 'deleteTrigger'
      | 'setTriggersPaused'
      | 'fireTrigger'
      | 'runTriggerFiring'
      | 'dismissTriggerFiring'
      | 'restoreTriggerFiring';
  }
>;

/** Sends a trigger command to its reducer; core's reduceCommand calls this. Pure. */
export function reduceTriggerCommand(
  slices: SlicesChangedByCommands,
  command: TriggerCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'createTrigger':
      return reduceCreateTrigger(slices, command, context);
    case 'updateTrigger':
      return reduceUpdateTrigger(slices, command);
    case 'deleteTrigger':
      return reduceDeleteTrigger(slices, command);
    case 'setTriggersPaused':
      return reduceSetTriggersPaused(slices, command);
    case 'fireTrigger':
      return reduceFireTrigger(slices, command, context);
    case 'runTriggerFiring':
      return reduceRunTriggerFiring(slices, command, context);
    case 'dismissTriggerFiring':
      return reduceDismissTriggerFiring(slices, command, context);
    case 'restoreTriggerFiring':
      return reduceRestoreTriggerFiring(slices, command, context);
  }
}
