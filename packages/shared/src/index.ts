// Public surface of @bajaovrlay/shared. Import from here, never from inner files.

// Schema for the body of GET /health, and the type it validates.
export { type HealthResponse, HealthResponseSchema } from './health/healthResponse.js';

// The race clock's arithmetic: one reading in, the time the clock shows at a moment out,
// and the whole second it shows for that time. Graphics import the same three from
// `@bajaovrlay/shared/clock`, which carries no Zod.
export {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  countWholeSecondsClockShows,
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
// detail the renderer gave about that status and, on a preview, the fields to stamp again.
export {
  type Instance,
  InstanceSchema,
  type InstanceStatus,
  InstanceStatusSchema,
  type InstanceTarget,
  InstanceTargetSchema,
} from './slices/instance.js';
// The `eventLog` slice: one line per command that changed something or was refused.
export {
  type EventLogEntry,
  EventLogEntrySchema,
  EventLogResultSchema,
} from './slices/eventLogEntry.js';
// Every slice together (GET /api/v1/state, WS hello) and the list of slice names.
export { type SliceName, SliceNameSchema, type Slices, SlicesSchema } from './slices/slices.js';

// Why a command was refused: a stable code and a pt-BR message.
export {
  type CommandError,
  type CommandErrorCode,
  CommandErrorCodeSchema,
  CommandErrorSchema,
} from './commands/commandError.js';
// takeGraphic: put a graphic on a layer with its data.
export { type TakeGraphicCommand, TakeGraphicCommandSchema } from './commands/takeGraphic.js';
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

// WebSocket messages from the server: hello, slice, commandResult and time.
export {
  type CommandResultMessage,
  CommandResultMessageSchema,
  HelloMessageSchema,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  SliceMessageSchema,
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

// Rundowns and items: both slices, field values, item colours and the seven item commands.
export * from './rundown/index.js';

// The preview output: previewItem, previewGraphic, stopPreview and takePreview.
export * from './preview/index.js';
