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
  type Overrides,
  OverrideSchema,
  OverridesSchema,
  SessionFieldOverrideSchema,
} from './override.js';
// Lays one source's overrides over its shapes (a car's correction follows the car).
export { applyOverridesToSnapshotShapes } from './applyOverrides.js';
// The two commands: set a correction (replacing one of the same key) and clear it.
export { type ClearOverrideCommand, ClearOverrideCommandSchema } from './clearOverride.js';
export { type SetOverrideCommand, SetOverrideCommandSchema } from './setOverride.js';
// What says which override a command is about, and whether a stored one has that key.
export { doesOverrideHaveKey, type OverrideKey } from './overrideKey.js';
// Whether a corrected value fits its canonical field (pt-BR sentence), and its label.
export { findProblemInOverrideValue, labelOfOverridableField } from './overrideValue.js';
// The correction a bound field can take ("Corrigir valor da fonte…"), or none.
export { findOverrideKeyOfBinding } from './overrideKeyOfBinding.js';
