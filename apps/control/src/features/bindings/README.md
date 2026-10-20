# apps/control/src/features/bindings

What the page says about fields that read a data source once they are on air
(BAJAOVRLAY-20). Start at `boundFieldsOfInstance.ts`: from an instance's entry of
`instanceBindings` (never its item), where each bound field reads ("Vinculado: …"), the
fields it fills, whether a correction changed it, and the correction it can take.

"Edição rápida" draws those fields read-only (`features/playout/QuickEditBoundField.tsx`);
choosing a field's source in the item editor is `features/schemaForm/BoundFieldControls.tsx`;
the correction dialog is `features/overrides/`.
