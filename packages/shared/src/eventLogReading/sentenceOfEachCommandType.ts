import type { Command } from '../commands/command.js';
import type { EventLogDetails } from '../slices/eventLogEntry.js';
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import * as sentencesOfItemsAndRundown from './sentencesOfItemsAndRundown.js';
import * as sentencesOfPreviews from './sentencesOfPreviews.js';
import * as sentencesOfSettings from './sentencesOfSettings.js';
import * as sentencesOfSourcesAndData from './sentencesOfSourcesAndData.js';
import * as sentencesOfTakesAndClears from './sentencesOfTakesAndClears.js';

/**
 * For every command type, the function that writes its history sentence, handed that
 * command, the names it may read and the row's details (only a take and a preview read
 * them). Written as a type over every command type, so a new command does not compile
 * until it has its sentence.
 */
export type SentenceOfEachCommandType = {
  [CommandType in Command['type']]: (
    command: CommandOfType<CommandType>,
    names: EventLogNames,
    details?: EventLogDetails,
  ) => string;
};

/**
 * The registry of history sentences (BAJAOVRLAY-30): one named formatter per command
 * type, in the file of its group, never one big switch. sentenceOfEachCommandType.test.ts
 * holds a real row for each and fails when a type has none.
 */
export const sentenceOfEachCommandType: SentenceOfEachCommandType = {
  updateInstanceData: sentencesOfTakesAndClears.describeUpdateInstanceData,
  reportInstanceStatus: sentencesOfTakesAndClears.describeReportInstanceStatus,
  clearLayer: sentencesOfTakesAndClears.describeClearLayer,
  clearAll: sentencesOfTakesAndClears.describeClearAll,
  nextOnLayer: sentencesOfTakesAndClears.describeNextOnLayer,
  undoOnLayer: sentencesOfTakesAndClears.describeUndoOnLayer,
  undoLastChangeOnProgram: sentencesOfTakesAndClears.describeUndoLastChangeOnProgram,
  takeItem: sentencesOfTakesAndClears.describeTakeItem,
  takeNext: sentencesOfTakesAndClears.describeTakeNext,
  takePreview: sentencesOfTakesAndClears.describeTakePreview,
  takeAllPreviews: sentencesOfTakesAndClears.describeTakeAllPreviews,
  runMacro: sentencesOfTakesAndClears.describeRunMacro,
  stopMacro: sentencesOfTakesAndClears.describeStopMacro,
  advanceMacroRun: sentencesOfTakesAndClears.describeAdvanceMacroRun,
  endMacroRun: sentencesOfTakesAndClears.describeEndMacroRun,
  showEvent: sentencesOfTakesAndClears.describeShowEvent,
  refreshBoundInstanceData: sentencesOfTakesAndClears.describeRefreshBoundInstanceData,
  switchObsScene: sentencesOfTakesAndClears.describeSwitchObsScene,
  recordObsSceneSwitchAnswer: sentencesOfTakesAndClears.describeRecordObsSceneSwitchAnswer,
  fireTrigger: sentencesOfTakesAndClears.describeFireTrigger,
  runTriggerFiring: sentencesOfTakesAndClears.describeRunTriggerFiring,
  previewItem: sentencesOfPreviews.describePreviewItem,
  stopPreview: sentencesOfPreviews.describeStopPreview,
  previewClearLayer: sentencesOfPreviews.describePreviewClearLayer,
  previewMacro: sentencesOfPreviews.describePreviewMacro,
  createItem: sentencesOfItemsAndRundown.describeCreateItem,
  updateItemFields: sentencesOfItemsAndRundown.describeUpdateItemFields,
  deleteItem: sentencesOfItemsAndRundown.describeDeleteItem,
  reorderItems: sentencesOfItemsAndRundown.describeReorderItems,
  moveCursor: sentencesOfItemsAndRundown.describeMoveCursor,
  createQuickFirePanel: sentencesOfItemsAndRundown.describeCreateQuickFirePanel,
  renameQuickFirePanel: sentencesOfItemsAndRundown.describeRenameQuickFirePanel,
  deleteQuickFirePanel: sentencesOfItemsAndRundown.describeDeleteQuickFirePanel,
  moveItemToHome: sentencesOfItemsAndRundown.describeMoveItemToHome,
  saveOnAirChangesIntoItem: sentencesOfItemsAndRundown.describeSaveOnAirChangesIntoItem,
  createMacro: sentencesOfItemsAndRundown.describeCreateMacro,
  updateMacro: sentencesOfItemsAndRundown.describeUpdateMacro,
  deleteMacro: sentencesOfItemsAndRundown.describeDeleteMacro,
  createTrigger: sentencesOfItemsAndRundown.describeCreateTrigger,
  updateTrigger: sentencesOfItemsAndRundown.describeUpdateTrigger,
  deleteTrigger: sentencesOfItemsAndRundown.describeDeleteTrigger,
  setTriggersPaused: sentencesOfItemsAndRundown.describeSetTriggersPaused,
  createDataSource: sentencesOfSourcesAndData.describeCreateDataSource,
  updateDataSource: sentencesOfSourcesAndData.describeUpdateDataSource,
  deleteDataSource: sentencesOfSourcesAndData.describeDeleteDataSource,
  setDataSourceEnabled: sentencesOfSourcesAndData.describeSetDataSourceEnabled,
  pollDataSourceNow: sentencesOfSourcesAndData.describePollDataSourceNow,
  restartSimulatedRace: sentencesOfSourcesAndData.describeRestartSimulatedRace,
  startRecording: sentencesOfSourcesAndData.describeStartRecording,
  stopRecording: sentencesOfSourcesAndData.describeStopRecording,
  recordDataSourcePoll: sentencesOfSourcesAndData.describeRecordDataSourcePoll,
  recordRecordingProgress: sentencesOfSourcesAndData.describeRecordRecordingProgress,
  setOverride: sentencesOfSourcesAndData.describeSetOverride,
  clearOverride: sentencesOfSourcesAndData.describeClearOverride,
  dismissEvent: sentencesOfSourcesAndData.describeDismissEvent,
  restoreEvent: sentencesOfSourcesAndData.describeRestoreEvent,
  dismissTriggerFiring: sentencesOfSourcesAndData.describeDismissTriggerFiring,
  restoreTriggerFiring: sentencesOfSourcesAndData.describeRestoreTriggerFiring,
  createManualEvent: sentencesOfSourcesAndData.describeCreateManualEvent,
  updateEventRule: sentencesOfSourcesAndData.describeUpdateEventRule,
  recordDetectedEvents: sentencesOfSourcesAndData.describeRecordDetectedEvents,
  upsertEntity: sentencesOfSourcesAndData.describeUpsertEntity,
  deleteEntity: sentencesOfSourcesAndData.describeDeleteEntity,
  importEntities: sentencesOfSourcesAndData.describeImportEntities,
  recordUploadedMedia: sentencesOfSourcesAndData.describeRecordUploadedMedia,
  deleteMedia: sentencesOfSourcesAndData.describeDeleteMedia,
  createOutput: sentencesOfSettings.describeCreateOutput,
  renameOutput: sentencesOfSettings.describeRenameOutput,
  deleteOutput: sentencesOfSettings.describeDeleteOutput,
  reorderOutputs: sentencesOfSettings.describeReorderOutputs,
  createLayer: sentencesOfSettings.describeCreateLayer,
  updateLayer: sentencesOfSettings.describeUpdateLayer,
  moveLayerToOutput: sentencesOfSettings.describeMoveLayerToOutput,
  reorderLayers: sentencesOfSettings.describeReorderLayers,
  deleteLayer: sentencesOfSettings.describeDeleteLayer,
  recordObsState: sentencesOfSettings.describeRecordObsState,
  recordBackup: sentencesOfSettings.describeRecordBackup,
};

/**
 * The history sentence of one valid command, from the registry. The registry's type
 * pairs each command type with its own command; TypeScript cannot follow that pairing
 * through a lookup by `command.type`, so the formatter is read as one taking any command,
 * which is safe because it is the formatter of exactly this command's type.
 */
export function describeCommand(
  command: Command,
  names: EventLogNames,
  details?: EventLogDetails,
): string {
  const formatterOfThisType = sentenceOfEachCommandType[command.type] as (
    command: Command,
    names: EventLogNames,
    details?: EventLogDetails,
  ) => string;
  return formatterOfThisType(command, names, details);
}
