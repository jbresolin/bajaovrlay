// Everything about data sources that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The four kinds of source: the race simulator, a replay of a recording, a flex HTTP/JSON
// source, a YouTube live's chat.
export { type DataSourceKind, DataSourceKindSchema } from './dataSourceKind.js';
// The simulator's config: seed, cars, duration, lap length, speed, start, failing switch.
export { type SimulatorConfig, SimulatorConfigSchema } from './simulatorConfig.js';
// The replay's config: recording, speed (one of replaySpeeds), loop, offset, start.
export { type ReplayConfig, ReplayConfigSchema, replaySpeeds } from './replayConfig.js';
// The flex source's config: its GET requests (headers and query parameters, a value or a
// BAJAOVRLAY_SOURCE_ variable, an optional refresh time) and the flex mapping of their
// responses; the range of a request's refresh time (1 minute to 1 hour).
export {
  type HttpJsonConfig,
  HttpJsonConfigSchema,
  type HttpJsonHeader,
  HttpJsonHeaderSchema,
  type HttpJsonQueryParameter,
  HttpJsonQueryParameterSchema,
  type HttpJsonRequest,
  HttpJsonRequestSchema,
  longestRequestRefreshMs,
  mostRequestsPerHttpJsonSource,
  shortestRequestRefreshMs,
  sourceEnvironmentVariablePrefix,
} from './httpJsonConfig.js';
// The answer of the sample route ("Buscar da fonte"): the parsed body, or the pt-BR error.
export { type HttpJsonSampleAnswer, HttpJsonSampleAnswerSchema } from './httpJsonSampleAnswer.js';
// The YouTube live chat source's config (the live's address), its video id read from the
// address, its poll interval's floor and default, and the quota usage on its status.
export {
  readYouTubeVideoIdFromAddress,
  type YouTubeLiveChatConfig,
  YouTubeLiveChatConfigSchema,
  youTubeLiveChatDefaultPollIntervalMs,
  youTubeLiveChatShortestPollIntervalMs,
  type YouTubeQuotaUsage,
  YouTubeQuotaUsageSchema,
} from './youtubeLiveChatConfig.js';
// The pt-BR reasons a YouTube live chat source's config or interval is refused.
export { ptBRYouTubeLiveChat } from './ptBRYouTubeLiveChat.js';
// The pt-BR reasons a flex source's config is refused, shared with the control page's form.
export { ptBRHttpJsonConfig } from './ptBRHttpJsonConfig.js';
// Whether two configs or snapshots hold the same JSON, whatever their key order: the
// server's no-op checks and the control page's "did this edit change the config?".
export { areJsonValuesEqual } from './areJsonValuesEqual.js';
// How often a source may be polled: 500 to 60 000 ms.
export { PollIntervalMsSchema } from './pollInterval.js';
// The `dataSources` slice: each source, its config by kind, and its health (status).
export {
  type DataSource,
  DataSourceSchema,
  type DataSourceStatus,
  DataSourceStatusSchema,
  type HttpJsonDataSource,
  HttpJsonDataSourceSchema,
  type ReplayDataSource,
  ReplayDataSourceSchema,
  type SimulatorDataSource,
  SimulatorDataSourceSchema,
  type YouTubeLiveChatDataSource,
  YouTubeLiveChatDataSourceSchema,
} from './dataSource.js';
// The `dataSnapshots` slice: the last good shapes of each source.
export {
  type DataSnapshot,
  DataSnapshotSchema,
  type DataSnapshotShapes,
  DataSnapshotShapesSchema,
} from './dataSnapshot.js';
// The `recordings` slice: the recorded feeds a replay can play.
export { type Recording, RecordingSchema } from './recording.js';
// createDataSource: "+ Fonte".
export { type CreateDataSourceCommand, CreateDataSourceCommandSchema } from './createDataSource.js';
// updateDataSource: "Editar" (label, config, poll interval).
export { type UpdateDataSourceCommand, UpdateDataSourceCommandSchema } from './updateDataSource.js';
// deleteDataSource: "Excluir"; the recordings stay.
export { type DeleteDataSourceCommand, DeleteDataSourceCommandSchema } from './deleteDataSource.js';
// setDataSourceEnabled: the on/off switch.
export {
  type SetDataSourceEnabledCommand,
  SetDataSourceEnabledCommandSchema,
} from './setDataSourceEnabled.js';
// pollDataSourceNow: "Atualizar agora".
export {
  type PollDataSourceNowCommand,
  PollDataSourceNowCommandSchema,
} from './pollDataSourceNow.js';
// restartSimulatedRace: "Reiniciar corrida" on a simulator's row.
export {
  type RestartSimulatedRaceCommand,
  RestartSimulatedRaceCommandSchema,
} from './restartSimulatedRace.js';
// startRecording: "Gravar".
export { type StartRecordingCommand, StartRecordingCommandSchema } from './startRecording.js';
// stopRecording: "Parar gravação", or the recorder after a failed write or at a cap.
export { type StopRecordingCommand, StopRecordingCommandSchema } from './stopRecording.js';
// recordDataSourcePoll: the poller's result of one poll (server only).
export {
  type RecordDataSourcePollCommand,
  RecordDataSourcePollCommandSchema,
} from './recordDataSourcePoll.js';
// recordRecordingProgress: the recorder's count of the lines it wrote (server only).
export {
  type RecordRecordingProgressCommand,
  RecordRecordingProgressCommandSchema,
} from './recordRecordingProgress.js';
