import { z } from 'zod';

import { PreviewGraphicCommandSchema } from '../preview/previewGraphic.js';
import { PreviewItemCommandSchema } from '../preview/previewItem.js';
import { StopPreviewCommandSchema } from '../preview/stopPreview.js';
import { TakePreviewCommandSchema } from '../preview/takePreview.js';
import { CreateItemCommandSchema } from '../rundown/createItem.js';
import { DeleteItemCommandSchema } from '../rundown/deleteItem.js';
import { MoveCursorCommandSchema } from '../rundown/moveCursor.js';
import { ReorderItemsCommandSchema } from '../rundown/reorderItems.js';
import { TakeItemCommandSchema } from '../rundown/takeItem.js';
import { TakeNextCommandSchema } from '../rundown/takeNext.js';
import { UpdateItemFieldsCommandSchema } from '../rundown/updateItemFields.js';
import { ClearAllCommandSchema } from './clearAll.js';
import { ClearLayerCommandSchema } from './clearLayer.js';
import { ReportInstanceStatusCommandSchema } from './reportInstanceStatus.js';
import { TakeGraphicCommandSchema } from './takeGraphic.js';
import { UpdateInstanceDataCommandSchema } from './updateInstanceData.js';

/**
 * Every command the server accepts, told apart by `type`. A command is the only way
 * state changes. Macro commands arrive later in M1.
 */
export const CommandSchema = z.discriminatedUnion('type', [
  TakeGraphicCommandSchema,
  UpdateInstanceDataCommandSchema,
  ReportInstanceStatusCommandSchema,
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
  // The preview commands (BAJAOVRLAY-15); their schemas live in ../preview/.
  PreviewItemCommandSchema,
  PreviewGraphicCommandSchema,
  StopPreviewCommandSchema,
  TakePreviewCommandSchema,
]);

/** A command after validation, with defaults filled in. */
export type Command = z.infer<typeof CommandSchema>;

/** A command as a client writes it, before defaults (takeGraphic's target may be left out). */
export type CommandInput = z.input<typeof CommandSchema>;
