// Public surface of the outputs module. Core and other modules import from here, never
// from the files inside.

// Loads the outputs and layers at boot: seeds a new database, gives an older one the
// program output with every layer on it.
export {
  loadOrSeedOutputAndLayerSlices,
  type OutputAndLayerSlicesAtBoot,
} from './loadOutputAndLayerSlices.js';
