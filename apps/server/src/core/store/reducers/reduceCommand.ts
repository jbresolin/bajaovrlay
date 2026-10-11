import type { Command } from '@bajaovrlay/shared';

import { reduceClearAll } from './clearAll.js';
import { reduceClearLayer } from './clearLayer.js';
import { reduceItemOrRundownCommand } from './reduceItemOrRundownCommand.js';
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
    // The item and rundown commands have a switch of their own, one reducer file each.
    case 'createItem':
    case 'updateItemFields':
    case 'deleteItem':
    case 'reorderItems':
    case 'moveCursor':
    case 'takeItem':
    case 'takeNext':
      return reduceItemOrRundownCommand(slices, command, context);
  }
}
