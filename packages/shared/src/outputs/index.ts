// Everything about outputs (and editing layers) that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The `outputs` slice: renderer addresses OBS loads, `program` always among them.
export {
  type Output,
  OutputIdSchema,
  type Outputs,
  OutputSchema,
  OutputsSchema,
  programOutputId,
} from './output.js';
// The slice's order (bottom to top), one output's layers, and the outputs program first.
export {
  listLayersOfOutputBottomToTop,
  listOutputsProgramFirst,
  sortLayersBottomToTop,
} from './layersOfOutputs.js';
// createOutput, renameOutput, deleteOutput, reorderOutputs: edit the outputs.
export { type CreateOutputCommand, CreateOutputCommandSchema } from './createOutput.js';
export { type DeleteOutputCommand, DeleteOutputCommandSchema } from './deleteOutput.js';
export { type RenameOutputCommand, RenameOutputCommandSchema } from './renameOutput.js';
export { type ReorderOutputsCommand, ReorderOutputsCommandSchema } from './reorderOutputs.js';
// createLayer, updateLayer, moveLayerToOutput, reorderLayers, deleteLayer: edit the layers.
export { type CreateLayerCommand, CreateLayerCommandSchema } from './createLayer.js';
export { type DeleteLayerCommand, DeleteLayerCommandSchema } from './deleteLayer.js';
export {
  type MoveLayerToOutputCommand,
  MoveLayerToOutputCommandSchema,
} from './moveLayerToOutput.js';
export { type ReorderLayersCommand, ReorderLayersCommandSchema } from './reorderLayers.js';
export { type UpdateLayerCommand, UpdateLayerCommandSchema } from './updateLayer.js';
