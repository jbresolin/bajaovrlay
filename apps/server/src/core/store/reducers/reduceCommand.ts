import type { Command } from '@bajaovrlay/shared';

import { describeUnexpectedServerError } from '../commandRefusals.js';
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
    case 'clearLayer':
      return reduceClearLayer(slices, command);
    case 'clearAll':
      return reduceClearAll(slices);
    // PLACEHOLDER (BAJAOVRLAY-13): the shared contract already accepts these seven
    // commands, but their reducers are not written yet, so each one is refused as a
    // server error and changes nothing. The server work of this task replaces this
    // block with one case per command, each calling its own reducer file.
    case 'createItem':
    case 'updateItemFields':
    case 'deleteItem':
    case 'reorderItems':
    case 'moveCursor':
    case 'takeItem':
    case 'takeNext':
      return { status: 'refused', error: describeUnexpectedServerError() };
  }
}
