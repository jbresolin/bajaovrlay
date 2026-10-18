// Everything about data sources that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The two kinds of source: the race simulator and a replay of a recording.
export { type DataSourceKind, DataSourceKindSchema } from './dataSourceKind.js';
// The simulator's config: seed, cars, duration, lap length, speed, start, failing switch.
export { type SimulatorConfig, SimulatorConfigSchema } from './simulatorConfig.js';
// The replay's config: recording, speed (one of replaySpeeds), loop, offset, start.
export { type ReplayConfig, ReplayConfigSchema, replaySpeeds } from './replayConfig.js';
// How often a source may be polled: 500 to 60 000 ms.
export { PollIntervalMsSchema } from './pollInterval.js';
// The `dataSources` slice: each source, its config by kind, and its health (status).
export {
  type DataSource,
  DataSourceSchema,
  type DataSourceStatus,
  DataSourceStatusSchema,
  type ReplayDataSource,
  ReplayDataSourceSchema,
  type SimulatorDataSource,
  SimulatorDataSourceSchema,
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
