import type { OperatorRole } from '../operatorLogin/operatorRole.js';
import type { Command } from './command.js';

/**
 * Who may send a command: `operator` (the control page, and Companion, a Stream Deck or a
 * script through POST /api/v1/commands, BAJAOVRLAY-28), or `server`, which only the
 * server itself sends (a renderer's report, a poller's results, a runner's bookkeeping).
 */
export type CommandSender = 'operator' | 'server';

/**
 * The two columns of one command: who sends it, and, for an operator's command, whether
 * the "Dados" role may send it too (BAJAOVRLAY-29). The "Produtor" role may send every
 * operator command; no role may send one of the server's.
 */
export type WhoMaySendACommand = { sender: CommandSender; mayTheDataRoleSend: boolean };

// The three kinds of row, named so the list below reads as a table.
const onlyTheServer: WhoMaySendACommand = { sender: 'server', mayTheDataRoleSend: false };
const theProducerOnly: WhoMaySendACommand = { sender: 'operator', mayTheDataRoleSend: false };
const bothRoles: WhoMaySendACommand = { sender: 'operator', mayTheDataRoleSend: true };

/**
 * Every command, classed once. A Record over every command type, so a new command does
 * not compile until someone decides who may send it, and commandSenders.test.ts checks
 * the list against CommandSchema itself and against a role table written out by hand.
 * Two commands are sent by both an operator and the server, and are classed as the
 * operator's: stopRecording (the recorder's carries a failureMessage, which the server's
 * authorisation step keeps from operators) and showEvent (the inbox shows an event whose
 * rule says auto). Which server actor may send which server command is decided by
 * apps/server/src/core/store/authorizeCommand.ts.
 * The role column (BAJAOVRLAY-29): Dados prepares the show (Cadastros, Fontes and
 * corrections, recordings, items, the rundown and quick-fire panels, macros and triggers
 * as edits, the inbox's rules, outputs and layers) and never changes what is on program
 * or preview: no take, clear, preview, "Tomar tudo", next, undo, macro run, OBS switch or
 * event "No ar". Where the brief left a command open (moving the rundown's cursor, "Salvar
 * no item", the inbox's and the triggers' waiting lists), it is the producer's.
 */
export const whoMaySendEachCommandType: Record<Command['type'], WhoMaySendACommand> = {
  updateInstanceData: theProducerOnly,
  // The renderer's "on air" or "failed"; it arrives as an instanceStatus message.
  reportInstanceStatus: onlyTheServer,
  clearLayer: theProducerOnly,
  clearAll: theProducerOnly,
  nextOnLayer: theProducerOnly,
  undoOnLayer: theProducerOnly,
  undoLastChangeOnProgram: theProducerOnly,
  createItem: bothRoles,
  updateItemFields: bothRoles,
  deleteItem: bothRoles,
  reorderItems: bothRoles,
  moveCursor: theProducerOnly,
  takeItem: theProducerOnly,
  takeNext: theProducerOnly,
  previewItem: theProducerOnly,
  stopPreview: theProducerOnly,
  takePreview: theProducerOnly,
  previewClearLayer: theProducerOnly,
  takeAllPreviews: theProducerOnly,
  previewMacro: theProducerOnly,
  createQuickFirePanel: bothRoles,
  renameQuickFirePanel: bothRoles,
  deleteQuickFirePanel: bothRoles,
  moveItemToHome: bothRoles,
  saveOnAirChangesIntoItem: theProducerOnly,
  createMacro: bothRoles,
  updateMacro: bothRoles,
  deleteMacro: bothRoles,
  runMacro: theProducerOnly,
  stopMacro: theProducerOnly,
  // The macro runner's own bookkeeping of a run (and the watchdog's endMacroRun).
  advanceMacroRun: onlyTheServer,
  endMacroRun: onlyTheServer,
  createDataSource: bothRoles,
  updateDataSource: bothRoles,
  deleteDataSource: bothRoles,
  setDataSourceEnabled: bothRoles,
  pollDataSourceNow: bothRoles,
  restartSimulatedRace: bothRoles,
  startRecording: bothRoles,
  stopRecording: bothRoles,
  // A poller's result: race data no page may fake.
  recordDataSourcePoll: onlyTheServer,
  // The recorder's count of lines written.
  recordRecordingProgress: onlyTheServer,
  // The new values of live bound fields after a poll; a correction is setOverride.
  refreshBoundInstanceData: onlyTheServer,
  setOverride: bothRoles,
  clearOverride: bothRoles,
  showEvent: theProducerOnly,
  // A Super Chat's moderation (BAJAOVRLAY-35): Dados reads the chat. Dados may dismiss a
  // Super Chat and nothing else; the store holds the kind against the events slice
  // (apps/server/src/core/store/automationAndTheDataRole.ts).
  approveEvent: bothRoles,
  dismissEvent: bothRoles,
  restoreEvent: theProducerOnly,
  createManualEvent: theProducerOnly,
  updateEventRule: bothRoles,
  // What the event detection found: no page may fake a race event.
  recordDetectedEvents: onlyTheServer,
  upsertEntity: bothRoles,
  deleteEntity: bothRoles,
  importEntities: bothRoles,
  // Lists a file the upload route has just written; a page could list one with no file.
  recordUploadedMedia: onlyTheServer,
  deleteMedia: bothRoles,
  createOutput: bothRoles,
  renameOutput: bothRoles,
  deleteOutput: bothRoles,
  reorderOutputs: bothRoles,
  createLayer: bothRoles,
  updateLayer: bothRoles,
  moveLayerToOutput: bothRoles,
  reorderLayers: bothRoles,
  deleteLayer: bothRoles,
  switchObsScene: theProducerOnly,
  // What OBS is doing and how it answered a switch: only the server's connection hears OBS.
  recordObsState: onlyTheServer,
  recordObsSceneSwitchAnswer: onlyTheServer,
  createTrigger: bothRoles,
  updateTrigger: bothRoles,
  deleteTrigger: bothRoles,
  setTriggersPaused: theProducerOnly,
  // A firing: only the trigger service sees the scene change, call, event or time behind it.
  fireTrigger: onlyTheServer,
  runTriggerFiring: theProducerOnly,
  dismissTriggerFiring: theProducerOnly,
  restoreTriggerFiring: theProducerOnly,
  // A finished backup: only the server knows the zip went out whole, and its size.
  recordBackup: onlyTheServer,
};

/** The command types only the server sends, read from whoMaySendEachCommandType. */
export const commandTypesOnlyTheServerSends: ReadonlyArray<Command['type']> = Object.entries(
  whoMaySendEachCommandType,
)
  .filter(([, whoMaySend]) => whoMaySend.sender === 'server')
  .map(([commandType]) => commandType as Command['type']);

/** Whether an operator (a control page or an API token) may send this type of command. */
export function isCommandTypeOfTheOperator(commandType: Command['type']): boolean {
  return whoMaySendEachCommandType[commandType].sender === 'operator';
}

/**
 * Whether an operator logged in with this role may send this type of command: the
 * Produtor every operator command, Dados only those its column allows (BAJAOVRLAY-29).
 */
export function isCommandTypeOpenToTheRole(
  commandType: Command['type'],
  role: OperatorRole,
): boolean {
  const whoMaySend = whoMaySendEachCommandType[commandType];
  if (whoMaySend.sender !== 'operator') {
    return false;
  }
  if (role === 'produtor') {
    return true;
  }
  return whoMaySend.mayTheDataRoleSend;
}
