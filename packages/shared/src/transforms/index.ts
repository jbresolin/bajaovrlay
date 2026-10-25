// Everything about the transform registry that @bajaovrlay/shared exports. The package's
// own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// What a transform is (of the mapping or the binding family), what it answers, the JSON
// values it hands back, and the read-only context a binding transform is handed (the teams).
export {
  type BindingTransform,
  type BindingTransformContext,
  type JsonValue,
  type MappingTransform,
  type Transform,
  type TransformFamily,
  type TransformResult,
} from './transform.js';
// Every transform there is, one family of them, and how to read one by its id.
export { findTransform, listTransformsOfFamily, transformRegistry } from './transformRegistry.js';
// Checks a transform id and its parameters when a config is validated (pt-BR reason).
export {
  checkTransformParameters,
  type TransformParametersCheck,
} from './checkTransformParameters.js';
// The parameters of mapValues: the value table.
export { type MapValuesParameters, MapValuesParametersSchema } from './mapValuesTransform.js';
// The parameters of the binding transforms that take any: topN's n, formatGapAsText's
// unit and shortenSchoolName's maximum length.
export { GapUnitParametersSchema } from './raceTimeTextTransforms.js';
export { ShortenSchoolNameParametersSchema } from './schoolNameTransforms.js';
export { TopNParametersSchema } from './topNTransform.js';
