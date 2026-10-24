// Public surface of the data-source module. Core and other modules import from here,
// never from the files inside.

// Sends each of the ten data-source commands to its reducer (core's reduceCommand calls it).
export {
  type DataSourceCommand,
  reduceDataSourceCommand,
} from './reducers/reduceDataSourceCommand.js';
// Loads the dataSources and dataSnapshots slices at boot, seeding the simulator when none.
export { type DataSourceSlicesAtBoot, loadOrSeedDataSourceSlices } from './loadDataSourceSlices.js';
// Lists the recordings in the recordings folder at boot, and where that folder is in DATA_DIR.
export { buildRecordingsFolderPath, readRecordingsFromFolder } from './recordingsFromFolder.js';
// Starts polling and recording with the server; stop() when it closes.
export {
  type DataSourceService,
  type DataSourceServiceOptions,
  startDataSourceService,
} from './service.js';
// The simulator's hundred fictional teams, car 1 first, for the entity library's import.
export { type FictionalTeam, listFictionalTeams } from './adapters/simulator/fictionalTeams.js';
// The REST route GET /api/v1/data-sources/{sourceId}/snapshot and the lookup it answers with.
export { findDataSnapshotAnswer, getDataSnapshotRoute } from './api.js';
// The REST route POST /api/v1/data-sources/http-json/sample-request and its 400 body.
export { buildInvalidSampleRequestAnswer, postHttpJsonSampleRequestRoute } from './api.js';
// "Buscar da fonte": one flex request fetched once, with the poll's caps and errors.
export { fetchSampleOfHttpJsonRequest } from './adapters/httpJson/fetchSampleOfHttpJsonRequest.js';
// How the server reads a BAJAOVRLAY_SOURCE_ variable: a table in tests, process.env otherwise.
export {
  type ReadEnvironmentVariable,
  readServerEnvironmentVariable,
} from './adapters/httpJson/httpJsonRequestAddress.js';
// BAJAOVRLAY_SOURCE_ALLOWED_HOSTS: its parsed form, the "no list" value and how the boot reads it.
export {
  noSourceHostAllowlist,
  parseSourceHostAllowlist,
  sourceAllowedHostsVariableName,
  type SourceHostAllowlist,
} from './adapters/httpJson/sourceHostAllowlist.js';
// The payload of a logged poll row: the source, ok, the moment, the error and the shape names.
export { type PollEventLogPayload, trimPollCommandForTheEventLog } from './pollEventLogPayload.js';
// The payload of the failed row of a poll that did not pass validation: type and sourceId only.
export {
  type InvalidPollEventLogPayload,
  trimInvalidPollForTheEventLog,
} from './pollEventLogPayload.js';
