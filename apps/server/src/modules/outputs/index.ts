// Public surface of the outputs module. Core and other modules import from here, never
// from the files inside.

// Sends each output or layer command (createOutput … deleteLayer) to its reducer; core's
// reduceCommand calls it.
export {
  type OutputOrLayerCommand,
  reduceOutputOrLayerCommand,
} from './reducers/reduceOutputOrLayerCommand.js';
// Loads the outputs and layers at boot: seeds a new database, gives an older one the
// program output with every layer on it.
export {
  loadOrSeedOutputAndLayerSlices,
  type OutputAndLayerSlicesAtBoot,
} from './loadOutputAndLayerSlices.js';
