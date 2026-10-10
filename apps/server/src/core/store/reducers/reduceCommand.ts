import type { Command } from '@bajaovrlay/shared';

import { refuseInvalidCommand } from '../commandRefusals.js';
import { reduceClearAll } from './clearAll.js';
import { reduceClearLayer } from './clearLayer.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeGraphic } from './takeGraphic.js';

/**
 * Sends a valid command to its reducer (one file per command). Pure: same slices,
 * command and context always give the same outcome, and nothing is read or written.
 */
export function reduceCommand(
  slices: SlicesChangedByCommands,
  command: Command,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'takeGraphic':
      return reduceTakeGraphic(slices, command, context);
    case 'updateInstanceData':
    case 'reportInstanceStatus':
      // PLACEHOLDER (BAJAOVRLAY-12): the shared schemas for these two commands landed
      // before their reducers. Until the server work of the same task replaces this
      // branch, they are refused exactly as they were before the schemas existed: as a
      // command whose `type` the server does not run.
      return { status: 'refused', error: refuseInvalidCommand(['type']) };
    case 'clearLayer':
      return reduceClearLayer(slices, command);
    case 'clearAll':
      return reduceClearAll(slices);
  }
}
