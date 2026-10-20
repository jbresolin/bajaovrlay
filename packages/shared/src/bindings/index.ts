// Everything about bindings (item fields read from a data source) that @bajaovrlay/shared
// exports. The package's own index.ts re-exports this file with one line; other packages
// import from '@bajaovrlay/shared', never from here.

// The binding field value: source, shape, path, car number, live or frozen, one transform.
export { type BindingFieldValue, BindingFieldValueSchema } from './bindingFieldValue.js';
// Whether a binding's parts make sense together (pt-BR sentence), and the type it reads.
export { findProblemInBinding, findValueTypeOfBinding } from './bindingProblems.js';
// Which value types fit a graphic's field, the clock fields by role, and the save check.
export {
  type ClockFieldKeysByRole,
  findClockFieldKeysByRole,
  findProblemInBindingForGraphicField,
  listValueTypesThatFitGraphicField,
} from './bindingFitsGraphicField.js';
// Reading one binding against the sources: snapshot, overrides, path, transform.
export {
  type BindingResolution,
  resolveBindingAgainstSources,
  type SourcesForBindings,
} from './bindingResolution.js';
// The instanceBindings slice: the bindings each instance kept from its take.
export {
  type InstanceBindings,
  type InstanceBindingsEntry,
  InstanceBindingsEntrySchema,
  InstanceBindingsSchema,
  type InstanceBoundField,
  InstanceBoundFieldSchema,
} from './instanceBindings.js';
