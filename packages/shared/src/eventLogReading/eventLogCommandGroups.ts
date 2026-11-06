import { z } from 'zod';

import type { Command } from '../commands/command.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

/**
 * The command groups of the history page's filter (BAJAOVRLAY-30): what went on or off
 * the air, the preview output, preparing items and the rundown, the data the show reads,
 * and the setup of outputs, layers and OBS's connection.
 */
export const EventLogCommandGroupSchema = z.enum([
  'takesAndClears',
  'previews',
  'itemsAndRundown',
  'sourcesAndData',
  'settings',
]);

/** One of EventLogCommandGroupSchema's values. */
export type EventLogCommandGroup = z.infer<typeof EventLogCommandGroupSchema>;

/** The pt-BR name of each group, for the filter. */
export const eventLogCommandGroupLabels: Record<EventLogCommandGroup, string> =
  ptBREventLogReading.commandGroupLabels;

/**
 * Every command, classed once. A Record over every command type, so a new command does
 * not compile until someone puts it in a group (as commandSenders.ts does for who may
 * send it). "Tomadas e limpezas" holds everything that changes what is on air, by hand or
 * by the server; "Prévias" only what changes the preview output.
 */
export const commandGroupOfEachCommandType: Record<Command['type'], EventLogCommandGroup> = {
  // An edit on air and a source's refresh change what the viewers see, like a take.
  updateInstanceData: 'takesAndClears',
  refreshBoundInstanceData: 'takesAndClears',
  // The renderer saying a graphic is on air (or failed) belongs beside the take it follows.
  reportInstanceStatus: 'takesAndClears',
  clearLayer: 'takesAndClears',
  clearAll: 'takesAndClears',
  nextOnLayer: 'takesAndClears',
  undoOnLayer: 'takesAndClears',
  undoLastChangeOnProgram: 'takesAndClears',
  takeItem: 'takesAndClears',
  takeNext: 'takesAndClears',
  // Taking a preview puts it on air: it is a take, whatever its name says.
  takePreview: 'takesAndClears',
  takeAllPreviews: 'takesAndClears',
  // A macro's run takes and clears; its bookkeeping follows the run.
  runMacro: 'takesAndClears',
  stopMacro: 'takesAndClears',
  advanceMacroRun: 'takesAndClears',
  endMacroRun: 'takesAndClears',
  showEvent: 'takesAndClears',
  // A scene switch changes what goes out, and OBS's answer says whether it did.
  switchObsScene: 'takesAndClears',
  recordObsSceneSwitchAnswer: 'takesAndClears',
  previewItem: 'previews',
  stopPreview: 'previews',
  previewClearLayer: 'previews',
  previewMacro: 'previews',
  createItem: 'itemsAndRundown',
  updateItemFields: 'itemsAndRundown',
  deleteItem: 'itemsAndRundown',
  reorderItems: 'itemsAndRundown',
  moveCursor: 'itemsAndRundown',
  createQuickFirePanel: 'itemsAndRundown',
  renameQuickFirePanel: 'itemsAndRundown',
  deleteQuickFirePanel: 'itemsAndRundown',
  moveItemToHome: 'itemsAndRundown',
  saveOnAirChangesIntoItem: 'itemsAndRundown',
  createMacro: 'itemsAndRundown',
  updateMacro: 'itemsAndRundown',
  deleteMacro: 'itemsAndRundown',
  createDataSource: 'sourcesAndData',
  updateDataSource: 'sourcesAndData',
  deleteDataSource: 'sourcesAndData',
  setDataSourceEnabled: 'sourcesAndData',
  pollDataSourceNow: 'sourcesAndData',
  restartSimulatedRace: 'sourcesAndData',
  startRecording: 'sourcesAndData',
  stopRecording: 'sourcesAndData',
  recordDataSourcePoll: 'sourcesAndData',
  recordRecordingProgress: 'sourcesAndData',
  setOverride: 'sourcesAndData',
  clearOverride: 'sourcesAndData',
  // The inbox's own bookkeeping is data; only showEvent puts something on air.
  dismissEvent: 'sourcesAndData',
  restoreEvent: 'sourcesAndData',
  createManualEvent: 'sourcesAndData',
  updateEventRule: 'sourcesAndData',
  recordDetectedEvents: 'sourcesAndData',
  upsertEntity: 'sourcesAndData',
  deleteEntity: 'sourcesAndData',
  importEntities: 'sourcesAndData',
  recordUploadedMedia: 'sourcesAndData',
  deleteMedia: 'sourcesAndData',
  createOutput: 'settings',
  renameOutput: 'settings',
  deleteOutput: 'settings',
  reorderOutputs: 'settings',
  createLayer: 'settings',
  updateLayer: 'settings',
  moveLayerToOutput: 'settings',
  reorderLayers: 'settings',
  deleteLayer: 'settings',
  // OBS connecting or dropping is the setup's health, not something taken.
  recordObsState: 'settings',
};
