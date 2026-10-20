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
// The slices one state change changed (a part of Slices, never dataSnapshots), how a client
// lays them over its own, and the names of the slices sent whole after the hello.
export {
  type ChangedSlices,
  ChangedSlicesSchema,
  mergeChangedSlicesIntoSlices,
  type SliceNameSentWhole,
  SliceNameSentWholeSchema,
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

// WebSocket messages from the server: hello, slice, slices, dataSnapshot, commandResult and time.
export {
  type CommandResultMessage,
  CommandResultMessageSchema,
  type DataSnapshotMessage,
  DataSnapshotMessageSchema,
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
// A page reloading itself, at most once per announced server build (once a minute when
// sessionStorage cannot keep that build), when the hello names another build than the
// one the page was loaded from; the browser's stand-ins it needs are typed here.
export {
  lastReloadForNewBuildStorageKey,
  measureWaitUntilTheNextReloadForNewBuild,
  type PageReloadForNewBuild,
  type ReloadForNewBuildOutcome,
  type ReloadMemory,
  reloadThePageWhenTheServerBuildDiffers,
  serverBuildLastReloadedForStorageKey,
  shortestTimeBetweenReloadsForNewBuildInMilliseconds,
} from './build/reloadForNewServerBuild.js';
// A page's own reload memory inside the sessionStorage its tab shares with other pages
// (the control page and its two monitor frames), keyed by the page's address.
export { keepTheReloadMemoryOfOnePageApart } from './build/reloadMemoryOfOnePage.js';
// The buildId of a hello read before the page's own schema checks the rest of it, so a
// page that refuses a newer server's hello can still reload onto the new bundle.
export { readBuildIdOfAHello } from './build/readBuildIdOfAHello.js';
// A page's watch on the server's build: compares each hello's build, logs, and, in the
// once-a-minute fallback, looks once more when a reload was skipped as too recent.
export {
  type CancelTimer,
  type ServerBuildWatch,
  type ServerBuildWatchOptions,
  startServerBuildWatch,
} from './build/serverBuildWatch.js';
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
// and the ten data-source commands (the last two, recordDataSourcePoll and
// recordRecordingProgress, server only).
export * from './dataSources/index.js';

// Canonical data shapes: session, positions, standings and brackets as every data source
// produces them, their validator and the paths a binding may point at.
export * from './dataShapes/index.js';

// The transform registry: the named pure functions a flex source's mapping applies to a
// value (textToNumber, lapTimeTextToMs, mapValues…), and the check a config runs on them.
export * from './transforms/index.js';

// Overrides: an operator's correction of a source's session field or of one car's field.
export * from './overrides/index.js';

// Bindings: item fields read from a data source, whether a binding makes sense, and
// which graphic fields it fits.
export * from './bindings/index.js';

// The flex mapping: paths into a JSON response, the mapping config of a flex source, the
// canonical fields a rule can fill, and applyFlexMapping, shared by the server and "Testar".
export * from './flexMapping/index.js';
