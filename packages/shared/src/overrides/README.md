# packages/shared/src/overrides

Overrides: an operator's correction of what one data source says, kept until it is cleared
and seen by every binding to that source (concept §4, BAJAOVRLAY-20). Start at
`override.ts`: an override is keyed by a session field, or by a car (its number) and one of
its fields, never by a place, so a car's correction follows the car up and down the list.
`applyOverridesToSnapshotShapes` (applyOverrides.ts) lays a source's overrides over its
shapes; the binding resolution (`../bindings/bindingResolution.ts`) runs it before reading a
path. `index.ts` lists every export.
