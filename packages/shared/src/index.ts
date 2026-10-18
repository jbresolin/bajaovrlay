// Public surface of @bajaovrlay/shared. Import from here, never from inner files.

// Schema for the body of GET /health, and the type it validates.
export { type HealthResponse, HealthResponseSchema } from './health/healthResponse.js';

// The race clock's arithmetic: one reading in, the time the clock shows at a moment out,
// the whole second it shows for that time, and that time as H:MM:SS text. Graphics import
// the same from `@bajaovrlay/shared/clock`, which carries no Zod.
export {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
  formatClockTimeAsHoursMinutesSeconds,
} from './clock/index.js';

// The `layers` slice: fixed screen slots, and how a layer swaps one graphic for the next.
export { type Layer, LayerReplacePolicySchema, LayerSchema } from './slices/layer.js';
// The `graphics` slice: registered OGraf packages, the manifest fields the server reads
// (including the data `schema`), and our `v_baja` vendor field (default layer, category,
// update rule).
export {
  type BajaVendorManifestFields,
  BajaVendorManifestFieldsSchema,
  type Graphic,
  GraphicSchema,
  type OGrafManifest,
  OGrafManifestSchema,
} from './slices/graphic.js';
// The `instances` slice: what is on each layer and output, its output, its status, the
// detail the renderer gave about that status and, on a preview, the fields to stamp again
// and who asked for the preview (PreviewOrigin: 'auto' or 'manual').
export {
  type Instance,
  InstanceSchema,
  type InstanceStatus,
  InstanceStatusSchema,
  type InstanceTarget,
  InstanceTargetSchema,
  type PreviewOrigin,
  PreviewOriginSchema,
} from './slices/instance.js';
// The `previewClearedLayerIds` slice: the layers Prévia shows empty ("vai limpar").
export {
  type PreviewClearedLayerIds,
  PreviewClearedLayerIdsSchema,
} from './slices/previewClearedLayerIds.js';
// The `eventLog` slice: one line per command that changed something or was refused.
export {
  type EventLogEntry,
  EventLogEntrySchema,
  EventLogResultSchema,
} from './slices/eventLogEntry.js';
// Every slice together (GET /api/v1/state, WS hello) and the list of slice names.
export { type SliceName, SliceNameSchema, type Slices, SlicesSchema } from './slices/slices.js';
// The slices one state change changed (a part of Slices), and how a client lays them over its own.
export {
  type ChangedSlices,
  ChangedSlicesSchema,
  mergeChangedSlicesIntoSlices,
} from './slices/changedSlices.js';

// Why a command was refused: a stable code and a pt-BR message.
export {
  type CommandError,
  type CommandErrorCode,
  CommandErrorCodeSchema,
  CommandErrorSchema,
} from './commands/commandError.js';
// updateInstanceData: change some of the data an instance shows, keeping it on its layer.
export {
  type UpdateInstanceDataCommand,
  UpdateInstanceDataCommandSchema,
} from './commands/updateInstanceData.js';
// reportInstanceStatus: what the renderer saw happen to an instance (on-air or failed),
// and the list of statuses a renderer may report.
export {
  type ReportedInstanceStatus,
  ReportedInstanceStatusSchema,
  type ReportInstanceStatusCommand,
  ReportInstanceStatusCommandSchema,
} from './commands/reportInstanceStatus.js';
// clearLayer: take everything off one layer.
export { type ClearLayerCommand, ClearLayerCommandSchema } from './commands/clearLayer.js';
// clearAll: take everything off every layer.
export { type ClearAllCommand, ClearAllCommandSchema } from './commands/clearAll.js';
// Every command, told apart by `type`; the only way state changes.
export { type Command, type CommandInput, CommandSchema } from './commands/command.js';

// WebSocket messages from the server: hello, slice, slices, commandResult and time.
export {
  type CommandResultMessage,
  CommandResultMessageSchema,
  HelloMessageSchema,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  SliceMessageSchema,
  type SlicesMessage,
  SlicesMessageSchema,
  type TimeMessage,
  TimeMessageSchema,
} from './ws/serverMessages.js';
// WebSocket messages from a client: command (control page) and instanceStatus (renderer).
export {
  type ClientMessage,
  ClientMessageSchema,
  type CommandMessage,
  CommandMessageSchema,
  type InstanceStatusMessage,
  InstanceStatusMessageSchema,
} from './ws/clientMessages.js';

// Rundowns and items: both slices, an item's home (rundown or quick-fire panel), field
// values, item colours and the eight item commands.
export * from './rundown/index.js';

// Quick-fire panels: the slice and the create, rename and delete commands.
export * from './quickFire/index.js';

// Macros: steps, the macros and macroRuns slices, and the six macro commands.
export * from './macros/index.js';

// The preview output: previewItem, stopPreview, takePreview,
// previewClearLayer, takeAllPreviews and previewMacro.
export * from './preview/index.js';

// Data sources: the dataSources, dataSnapshots and recordings slices, each kind's config,
// and the eight data-source commands (the last, recordDataSourcePoll, server only).
export * from './dataSources/index.js';

// Canonical data shapes: session, positions, standings and brackets as every data source
// produces them, their validator and the paths a binding may point at.
export * from './dataShapes/index.js';
