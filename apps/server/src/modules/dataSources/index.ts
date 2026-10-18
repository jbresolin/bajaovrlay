// Public surface of the data-source module. Core and other modules import from here,
// never from the files inside.

// Sends each of the eight data-source commands to its reducer (core's reduceCommand calls it).
export {
  type DataSourceCommand,
  reduceDataSourceCommand,
} from './reducers/reduceDataSourceCommand.js';
// Loads the dataSources and dataSnapshots slices at boot, seeding the simulator when none.
export { type DataSourceSlicesAtBoot, loadOrSeedDataSourceSlices } from './loadDataSourceSlices.js';
// Starts polling (and later recording) with the server; stop() when it closes.
export {
  type DataSourceService,
  type DataSourceServiceOptions,
  startDataSourceService,
} from './service.js';
// The REST route GET /api/v1/data-sources/{sourceId}/snapshot and the lookup it answers with.
export { findDataSnapshotAnswer, getDataSnapshotRoute } from './api.js';
