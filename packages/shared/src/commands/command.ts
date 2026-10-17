import { z } from 'zod';

import { CreateMacroCommandSchema } from '../macros/createMacro.js';
import { DeleteMacroCommandSchema } from '../macros/deleteMacro.js';
import {
  AdvanceMacroRunCommandSchema,
  EndMacroRunCommandSchema,
} from '../macros/macroRunBookkeeping.js';
import { RunMacroCommandSchema } from '../macros/runMacro.js';
import { StopMacroCommandSchema } from '../macros/stopMacro.js';
import { UpdateMacroCommandSchema } from '../macros/updateMacro.js';
import { PreviewClearLayerCommandSchema } from '../preview/previewClearLayer.js';
import { PreviewGraphicCommandSchema } from '../preview/previewGraphic.js';
import { PreviewItemCommandSchema } from '../preview/previewItem.js';
import { PreviewMacroCommandSchema } from '../preview/previewMacro.js';
import { StopPreviewCommandSchema } from '../preview/stopPreview.js';
import { TakeAllPreviewsCommandSchema } from '../preview/takeAllPreviews.js';
import { TakePreviewCommandSchema } from '../preview/takePreview.js';
import { CreateQuickFirePanelCommandSchema } from '../quickFire/createQuickFirePanel.js';
import { DeleteQuickFirePanelCommandSchema } from '../quickFire/deleteQuickFirePanel.js';
import { RenameQuickFirePanelCommandSchema } from '../quickFire/renameQuickFirePanel.js';
import { CreateItemCommandSchema } from '../rundown/createItem.js';
import { DeleteItemCommandSchema } from '../rundown/deleteItem.js';
import { MoveCursorCommandSchema } from '../rundown/moveCursor.js';
import { MoveItemToHomeCommandSchema } from '../rundown/moveItemToHome.js';
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
 * state changes.
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
  // Prévia shows the result: "will be cleared" markers, "Tomar tudo" and a macro's
  // preview (BAJAOVRLAY-36); their schemas live in ../preview/ too.
  PreviewClearLayerCommandSchema,
  TakeAllPreviewsCommandSchema,
  PreviewMacroCommandSchema,
  // Quick-fire panels and moving an item between homes (BAJAOVRLAY-16); ../quickFire/
  // and ../rundown/moveItemToHome.ts.
  CreateQuickFirePanelCommandSchema,
  RenameQuickFirePanelCommandSchema,
  DeleteQuickFirePanelCommandSchema,
  MoveItemToHomeCommandSchema,
  // Macros (BAJAOVRLAY-16); their schemas live in ../macros/. The last two are sent only
  // by the server (the macro runner, and the watchdog for endMacroRun).
  CreateMacroCommandSchema,
  UpdateMacroCommandSchema,
  DeleteMacroCommandSchema,
  RunMacroCommandSchema,
  StopMacroCommandSchema,
  AdvanceMacroRunCommandSchema,
  EndMacroRunCommandSchema,
]);

/** A command after validation, with defaults filled in. */
export type Command = z.infer<typeof CommandSchema>;

/** A command as a client writes it, before defaults (takeGraphic's target may be left out). */
export type CommandInput = z.input<typeof CommandSchema>;
