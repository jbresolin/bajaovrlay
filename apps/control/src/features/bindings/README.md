# apps/control/src/features/bindings

What the page says about fields that read a data source once they are on air
(BAJAOVRLAY-20). Start at `boundFieldsOfInstance.ts`: from an instance's entry of
`instanceBindings` (never its item), where each bound field reads ("Vinculado: …"), the
fields it fills, whether a correction changed it, and the correction it can take.
`sourceValueText.ts` writes any value read from a source in pt-BR, for every place that
shows one; `sourceStateOfInstance.ts` and `BoundSourceChips.tsx` are the Camadas chips.
`itemTakeReadiness.ts` says whether a bound item can be taken now, with
`dataSchemaFieldFacts.ts` (a field's title, the required keys), which the library's
check (`features/entityLibrary/itemEntityReadiness.ts`) uses too.

"Edição rápida" draws those fields read-only (`features/playout/QuickEditBoundField.tsx`);
choosing a field's source in the item editor is `features/schemaForm/BoundFieldControls.tsx`;
the correction dialog is `features/overrides/`.
