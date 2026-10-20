// Everything about overrides (operator corrections of a source's data) that
// @bajaovrlay/shared exports. The package's own index.ts re-exports this file with one line;
// other packages import from '@bajaovrlay/shared', never from here.

// One override: a session field or a car's field of one source, its value, reason, author.
export {
  CarFieldOverrideSchema,
  type OverridableCarField,
  OverridableCarFieldSchema,
  type OverridableSessionField,
  OverridableSessionFieldSchema,
  type Override,
  OverrideSchema,
  SessionFieldOverrideSchema,
} from './override.js';
// Lays one source's overrides over its shapes (a car's correction follows the car).
export { applyOverridesToSnapshotShapes } from './applyOverrides.js';
