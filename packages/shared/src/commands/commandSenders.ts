import type { Command } from './command.js';

/**
 * Who may send a command: `operator` (the control page, and Companion, a Stream Deck or a
 * script through POST /api/v1/commands, BAJAOVRLAY-28), or `server`, which only the
 * server itself sends (a renderer's report, a poller's results, a runner's bookkeeping).
 */
export type CommandSender = 'operator' | 'server';

/**
 * Every command, classed once. A Record over every command type, so a new command does
 * not compile until someone decides who may send it, and commandSenders.test.ts checks
 * the list against CommandSchema itself.
 * Two commands are sent by both an operator and the server, and are classed `operator`:
 * stopRecording (the recorder's carries a failureMessage, which the server's
 * authorisation step keeps from operators) and showEvent (the inbox shows an event whose
 * rule says auto). Which server actor may send which `server` command is decided by
 * apps/server/src/core/store/authorizeCommand.ts.
 */
export const senderOfEachCommandType: Record<Command['type'], CommandSender> = {
  updateInstanceData: 'operator',
  // The renderer's "on air" or "failed"; it arrives as an instanceStatus message.
  reportInstanceStatus: 'server',
  clearLayer: 'operator',
  clearAll: 'operator',
  nextOnLayer: 'operator',
  undoOnLayer: 'operator',
  undoLastChangeOnProgram: 'operator',
  createItem: 'operator',
  updateItemFields: 'operator',
  deleteItem: 'operator',
  reorderItems: 'operator',
  moveCursor: 'operator',
  takeItem: 'operator',
  takeNext: 'operator',
  previewItem: 'operator',
  stopPreview: 'operator',
  takePreview: 'operator',
  previewClearLayer: 'operator',
  takeAllPreviews: 'operator',
  previewMacro: 'operator',
  createQuickFirePanel: 'operator',
  renameQuickFirePanel: 'operator',
  deleteQuickFirePanel: 'operator',
  moveItemToHome: 'operator',
  saveOnAirChangesIntoItem: 'operator',
  createMacro: 'operator',
  updateMacro: 'operator',
  deleteMacro: 'operator',
  runMacro: 'operator',
  stopMacro: 'operator',
  // The macro runner's own bookkeeping of a run (and the watchdog's endMacroRun).
  advanceMacroRun: 'server',
  endMacroRun: 'server',
  createDataSource: 'operator',
  updateDataSource: 'operator',
  deleteDataSource: 'operator',
  setDataSourceEnabled: 'operator',
  pollDataSourceNow: 'operator',
  restartSimulatedRace: 'operator',
  startRecording: 'operator',
  stopRecording: 'operator',
  // A poller's result: race data no page may fake.
  recordDataSourcePoll: 'server',
  // The recorder's count of lines written.
  recordRecordingProgress: 'server',
  // The new values of live bound fields after a poll; a correction is setOverride.
  refreshBoundInstanceData: 'server',
  setOverride: 'operator',
  clearOverride: 'operator',
  showEvent: 'operator',
  dismissEvent: 'operator',
  restoreEvent: 'operator',
  createManualEvent: 'operator',
  updateEventRule: 'operator',
  // What the event detection found: no page may fake a race event.
  recordDetectedEvents: 'server',
  upsertEntity: 'operator',
  deleteEntity: 'operator',
  importEntities: 'operator',
  // Lists a file the upload route has just written; a page could list one with no file.
  recordUploadedMedia: 'server',
  deleteMedia: 'operator',
  createOutput: 'operator',
  renameOutput: 'operator',
  deleteOutput: 'operator',
  reorderOutputs: 'operator',
  createLayer: 'operator',
  updateLayer: 'operator',
  moveLayerToOutput: 'operator',
  reorderLayers: 'operator',
  deleteLayer: 'operator',
  switchObsScene: 'operator',
  // What OBS is doing and how it answered a switch: only the server's connection hears OBS.
  recordObsState: 'server',
  recordObsSceneSwitchAnswer: 'server',
  createTrigger: 'operator',
  updateTrigger: 'operator',
  deleteTrigger: 'operator',
  setTriggersPaused: 'operator',
  // A firing: only the trigger service sees the scene change, call, event or time behind it.
  fireTrigger: 'server',
  runTriggerFiring: 'operator',
  dismissTriggerFiring: 'operator',
  restoreTriggerFiring: 'operator',
  // A finished backup: only the server knows the zip went out whole, and its size.
  recordBackup: 'server',
};

/** The command types only the server sends, read from senderOfEachCommandType. */
export const commandTypesOnlyTheServerSends: ReadonlyArray<Command['type']> = Object.entries(
  senderOfEachCommandType,
)
  .filter(([, sender]) => sender === 'server')
  .map(([commandType]) => commandType as Command['type']);

/** Whether an operator (a control page or an API token) may send this type of command. */
export function isCommandTypeOfTheOperator(commandType: Command['type']): boolean {
  return senderOfEachCommandType[commandType] === 'operator';
}
