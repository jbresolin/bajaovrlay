// Everything about the preview output that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// previewItem: show one item on the preview output of its layer, saying who asked (origin).
export { type PreviewItemCommand, PreviewItemCommandSchema } from './previewItem.js';
// stopPreview: throw away the preview of one layer, or of every layer (layerId null).
export { type StopPreviewCommand, StopPreviewCommandSchema } from './stopPreview.js';
// takePreview: send what is previewed on one layer to the program output.
export { type TakePreviewCommand, TakePreviewCommandSchema } from './takePreview.js';
// previewClearLayer: mark one layer "will be cleared", so Prévia shows it empty.
export {
  type PreviewClearLayerCommand,
  PreviewClearLayerCommandSchema,
} from './previewClearLayer.js';
// takeAllPreviews: "Tomar tudo", every preview and every marker to program in one cut, and
// a layer it left because another console had just changed it (BAJAOVRLAY-69).
export {
  type LayerNotTaken,
  LayerNotTakenSchema,
  type TakeAllPreviewsCommand,
  TakeAllPreviewsCommandSchema,
} from './takeAllPreviews.js';
// previewMacro: show a macro's end state on the preview output, program untouched.
export { type PreviewMacroCommand, PreviewMacroCommandSchema } from './previewMacro.js';
