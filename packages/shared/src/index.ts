// Public surface of @bajaovrlay/shared. Import from here, never from inner files.

// Schema for the body of GET /health, and the type it validates.
export { type HealthResponse, HealthResponseSchema } from './health/healthResponse.js';

// The `layers` slice: fixed screen slots, and how a layer swaps one graphic for the next.
export { type Layer, LayerReplacePolicySchema, LayerSchema } from './slices/layer.js';
// The `graphics` slice: registered OGraf packages, and the manifest fields the server reads.
export { type Graphic, GraphicSchema, OGrafManifestSchema } from './slices/graphic.js';
// The `instances` slice: what is on each layer and output, its output and its status.
export {
  type Instance,
  InstanceSchema,
  InstanceStatusSchema,
  type InstanceTarget,
  InstanceTargetSchema,
} from './slices/instance.js';
// The `eventLog` slice: one line per command, ok or failed with its error.
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
// clearLayer: take everything off one layer.
export { type ClearLayerCommand, ClearLayerCommandSchema } from './commands/clearLayer.js';
// clearAll: take everything off every layer.
export { type ClearAllCommand, ClearAllCommandSchema } from './commands/clearAll.js';
// Every command, told apart by `type`; the only way state changes.
export { type Command, type CommandInput, CommandSchema } from './commands/command.js';

// WebSocket messages from the server: hello, slice and commandResult.
export {
  type CommandResultMessage,
  CommandResultMessageSchema,
  HelloMessageSchema,
  type ServerMessage,
  ServerMessageSchema,
  type SliceMessage,
  SliceMessageSchema,
} from './ws/serverMessages.js';
// WebSocket messages from a client: command.
export {
  type ClientMessage,
  ClientMessageSchema,
  CommandMessageSchema,
} from './ws/clientMessages.js';

// Rundowns and items: both slices, field values, item colours and the seven item commands.
export * from './rundown/index.js';
