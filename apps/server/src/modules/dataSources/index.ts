// Public surface of the data-source module. Core and other modules import from here,
// never from the files inside.

// Sends each of the eight data-source commands to its reducer (core's reduceCommand calls it).
export {
  type DataSourceCommand,
  reduceDataSourceCommand,
} from './reducers/reduceDataSourceCommand.js';
// Loads the dataSources and dataSnapshots slices at boot, seeding the simulator when none.
export { type DataSourceSlicesAtBoot, loadOrSeedDataSourceSlices } from './loadDataSourceSlices.js';
