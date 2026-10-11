import type {
  CreateItemCommand,
  DeleteItemCommand,
  MoveCursorCommand,
  ReorderItemsCommand,
  TakeItemCommand,
  TakeNextCommand,
  UpdateItemFieldsCommand,
} from '@bajaovrlay/shared';

import { reduceCreateItem } from './createItem.js';
import { reduceDeleteItem } from './deleteItem.js';
import { reduceMoveCursor } from './moveCursor.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceReorderItems } from './reorderItems.js';
import { reduceTakeItem } from './takeItem.js';
import { reduceTakeNext } from './takeNext.js';
import { reduceUpdateItemFields } from './updateItemFields.js';

/** The seven commands that prepare, order and fire the items of a rundown. */
export type ItemOrRundownCommand =
  | CreateItemCommand
  | UpdateItemFieldsCommand
  | DeleteItemCommand
  | ReorderItemsCommand
  | MoveCursorCommand
  | TakeItemCommand
  | TakeNextCommand;

/**
 * Sends an item or rundown command to its reducer (one file per command). Pure, like
 * reduceCommand, which calls this for those seven commands.
 * Deliberate: these cases are a second switch in a file of their own, and not seven more
 * lines in reduceCommand.ts, so that file gains a single import while another task
 * (BAJAOVRLAY-12) is adding its own imports and cases to it.
 */
export function reduceItemOrRundownCommand(
  slices: SlicesChangedByCommands,
  command: ItemOrRundownCommand,
  context: ReducerContext,
): ReducerOutcome {
  switch (command.type) {
    case 'createItem':
      return reduceCreateItem(slices, command, context);
    case 'updateItemFields':
      return reduceUpdateItemFields(slices, command);
    case 'deleteItem':
      return reduceDeleteItem(slices, command);
    case 'reorderItems':
      return reduceReorderItems(slices, command);
    case 'moveCursor':
      return reduceMoveCursor(slices, command);
    case 'takeItem':
      return reduceTakeItem(slices, command, context);
    case 'takeNext':
      return reduceTakeNext(slices, command, context);
  }
}
