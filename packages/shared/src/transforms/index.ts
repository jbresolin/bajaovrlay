// Everything about the transform registry that @bajaovrlay/shared exports. The package's
// own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// What a transform is, what it answers, and the JSON values it hands back.
export { type JsonValue, type Transform, type TransformResult } from './transform.js';
// Every transform there is, and how to read one by its id.
export { findTransform, transformRegistry } from './transformRegistry.js';
// Checks a transform id and its parameters when a config is validated (pt-BR reason).
export {
  checkTransformParameters,
  type TransformParametersCheck,
} from './checkTransformParameters.js';
// The parameters of mapValues, the one transform that takes any: the value table.
export { type MapValuesParameters, MapValuesParametersSchema } from './mapValuesTransform.js';
