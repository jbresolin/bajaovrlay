import { z } from 'zod';

import { RefreshBoundInstanceDataCommandSchema } from '../bindings/refreshBoundInstanceData.js';
import { CreateDataSourceCommandSchema } from '../dataSources/createDataSource.js';
import { DeleteDataSourceCommandSchema } from '../dataSources/deleteDataSource.js';
import { PollDataSourceNowCommandSchema } from '../dataSources/pollDataSourceNow.js';
import { RecordDataSourcePollCommandSchema } from '../dataSources/recordDataSourcePoll.js';
import { RecordRecordingProgressCommandSchema } from '../dataSources/recordRecordingProgress.js';
import { RestartSimulatedRaceCommandSchema } from '../dataSources/restartSimulatedRace.js';
import { SetDataSourceEnabledCommandSchema } from '../dataSources/setDataSourceEnabled.js';
import { StartRecordingCommandSchema } from '../dataSources/startRecording.js';
import { StopRecordingCommandSchema } from '../dataSources/stopRecording.js';
import { UpdateDataSourceCommandSchema } from '../dataSources/updateDataSource.js';
import { DeleteEntityCommandSchema } from '../entities/deleteEntity.js';
import { ImportEntitiesCommandSchema } from '../entities/importEntities.js';
import { UpsertEntityCommandSchema } from '../entities/upsertEntity.js';
import {
  CreateManualEventCommandSchema,
  DismissEventCommandSchema,
  RecordDetectedEventsCommandSchema,
  ShowEventCommandSchema,
  UpdateEventRuleCommandSchema,
} from '../eventInbox/eventCommands.js';
import { CreateMacroCommandSchema } from '../macros/createMacro.js';
import { DeleteMacroCommandSchema } from '../macros/deleteMacro.js';
import {
  AdvanceMacroRunCommandSchema,
  EndMacroRunCommandSchema,
} from '../macros/macroRunBookkeeping.js';
import { RunMacroCommandSchema } from '../macros/runMacro.js';
import { StopMacroCommandSchema } from '../macros/stopMacro.js';
import { UpdateMacroCommandSchema } from '../macros/updateMacro.js';
import {
  DeleteMediaCommandSchema,
  RecordUploadedMediaCommandSchema,
} from '../media/mediaCommands.js';
import { ClearOverrideCommandSchema } from '../overrides/clearOverride.js';
import { SetOverrideCommandSchema } from '../overrides/setOverride.js';
import { PreviewClearLayerCommandSchema } from '../preview/previewClearLayer.js';
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
import { SaveOnAirChangesIntoItemCommandSchema } from '../rundown/saveOnAirChangesIntoItem.js';
import { TakeItemCommandSchema } from '../rundown/takeItem.js';
import { TakeNextCommandSchema } from '../rundown/takeNext.js';
import { UpdateItemFieldsCommandSchema } from '../rundown/updateItemFields.js';
import { ClearAllCommandSchema } from './clearAll.js';
import { ClearLayerCommandSchema } from './clearLayer.js';
import { ReportInstanceStatusCommandSchema } from './reportInstanceStatus.js';
import { UpdateInstanceDataCommandSchema } from './updateInstanceData.js';

/**
 * Every command the server accepts, told apart by `type`. A command is the only way
 * state changes. Deliberate: no command puts a graphic on an output by itself. Since
 * BAJAOVRLAY-37 everything on air or in preview comes from an item (takeItem, takeNext,
 * previewItem, a macro); takeGraphic and previewGraphic, which did it with hand-typed
 * data, were removed, and the server's internal take step is not a command.
 */
export const CommandSchema = z.discriminatedUnion('type', [
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
  // Saving what was changed on air into the item (BAJAOVRLAY-37); ../rundown/.
  SaveOnAirChangesIntoItemCommandSchema,
  // Macros (BAJAOVRLAY-16); their schemas live in ../macros/. The last two are sent only
  // by the server (the macro runner, and the watchdog for endMacroRun).
  CreateMacroCommandSchema,
  UpdateMacroCommandSchema,
  DeleteMacroCommandSchema,
  RunMacroCommandSchema,
  StopMacroCommandSchema,
  AdvanceMacroRunCommandSchema,
  EndMacroRunCommandSchema,
  // Data sources (BAJAOVRLAY-17); their schemas live in ../dataSources/. The last two are
  // sent only by the server: the poller (sistema:fonte:<sourceId>) and the recorder
  // (sistema:gravador).
  CreateDataSourceCommandSchema,
  UpdateDataSourceCommandSchema,
  DeleteDataSourceCommandSchema,
  SetDataSourceEnabledCommandSchema,
  PollDataSourceNowCommandSchema,
  RestartSimulatedRaceCommandSchema,
  StartRecordingCommandSchema,
  StopRecordingCommandSchema,
  RecordDataSourcePollCommandSchema,
  RecordRecordingProgressCommandSchema,
  // Bindings (BAJAOVRLAY-20); ../bindings/. Sent only by the server's refresher
  // (sistema:vinculos) when a source's data changes.
  RefreshBoundInstanceDataCommandSchema,
  // Overrides (BAJAOVRLAY-20); ../overrides/. Operators only.
  SetOverrideCommandSchema,
  ClearOverrideCommandSchema,
  // The event inbox (BAJAOVRLAY-44); ../eventInbox/. recordDetectedEvents is sent only by
  // the server's event detection (sistema:eventos), which may also send showEvent.
  ShowEventCommandSchema,
  DismissEventCommandSchema,
  CreateManualEventCommandSchema,
  UpdateEventRuleCommandSchema,
  RecordDetectedEventsCommandSchema,
  // The entity library (BAJAOVRLAY-19); ../entities/. Operators only. Each is a union of
  // its own on entityType, so the record is checked by the schema of the type it names.
  UpsertEntityCommandSchema,
  DeleteEntityCommandSchema,
  ImportEntitiesCommandSchema,
  // The media store (BAJAOVRLAY-19); ../media/. recordUploadedMedia is sent only by the
  // server's media store (sistema:midia) after the upload route wrote the file.
  RecordUploadedMediaCommandSchema,
  DeleteMediaCommandSchema,
]);

/** A command after validation, with defaults filled in. */
export type Command = z.infer<typeof CommandSchema>;

/** A command as a client writes it, before defaults (previewItem's origin may be left out). */
export type CommandInput = z.input<typeof CommandSchema>;
