import type { Command } from '@bajaovrlay/shared';

import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { reduceCreateManualEvent } from './createManualEvent.js';
import { reduceDismissEvent } from './dismissEvent.js';
import { reduceRecordDetectedEvents } from './recordDetectedEvents.js';
import { reduceShowEvent } from './showEvent.js';
import { reduceUpdateEventRule } from './updateEventRule.js';

/** The commands of the event inbox, one reducer file each. */
export type EventInboxCommand = Extract<
  Command,
  {
    type:
      | 'showEvent'
      | 'dismissEvent'
      | 'createManualEvent'
      | 'updateEventRule'
      | 'recordDetectedEvents';
  }
>;

/** Sends an inbox command to its reducer; core's reduceCommand calls this. */
export function reduceEventInboxCommand(
  slices: SlicesChangedByCommands,
  command: EventInboxCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'showEvent':
      return reduceShowEvent(slices, command, context);
    case 'dismissEvent':
      return reduceDismissEvent(slices, command, context);
    case 'createManualEvent':
      return reduceCreateManualEvent(slices, command, context);
    case 'updateEventRule':
      return reduceUpdateEventRule(slices, command);
    case 'recordDetectedEvents':
      return reduceRecordDetectedEvents(slices, command);
  }
}
