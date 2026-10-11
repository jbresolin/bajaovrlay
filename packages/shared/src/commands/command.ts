import { z } from 'zod';

import { CreateItemCommandSchema } from '../rundown/createItem.js';
import { DeleteItemCommandSchema } from '../rundown/deleteItem.js';
import { MoveCursorCommandSchema } from '../rundown/moveCursor.js';
import { ReorderItemsCommandSchema } from '../rundown/reorderItems.js';
import { TakeItemCommandSchema } from '../rundown/takeItem.js';
import { TakeNextCommandSchema } from '../rundown/takeNext.js';
import { UpdateItemFieldsCommandSchema } from '../rundown/updateItemFields.js';
import { ClearAllCommandSchema } from './clearAll.js';
import { ClearLayerCommandSchema } from './clearLayer.js';
import { TakeGraphicCommandSchema } from './takeGraphic.js';

/**
 * Every command the server accepts, told apart by `type`. A command is the only way
 * state changes. takeItem and the rundown commands arrive in M1.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  TakeGraphicCommandSchema,
  ClearLayerCommandSchema,
  ClearAllCommandSchema,
  // The item and rundown commands (BAJAOVRLAY-13); their schemas live in ../rundown/.
  CreateItemCommandSchema,
  UpdateItemFieldsCommandSchema,
  DeleteItemCommandSchema,
  ReorderItemsCommandSchema,
  MoveCursorCommandSchema,
  TakeItemCommandSchema,
  TakeNextCommandSchema,
]);

/** A command after validation, with defaults filled in. */
export type Command = z.infer<typeof CommandSchema>;

/** A command as a client writes it, before defaults (takeGraphic's target may be left out). */
export type CommandInput = z.input<typeof CommandSchema>;
