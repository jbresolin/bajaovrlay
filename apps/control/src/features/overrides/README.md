# apps/control/src/features/overrides

Corrections of what a data source says (overrides, BAJAOVRLAY-20): an operator-typed value
that wins over the source, everywhere it is bound, until it is removed. Start at
`OverrideDialog.tsx`, the one dialog of "Corrigir valor…" (Fontes tables) and "Corrigir
valor da fonte…" (Edição rápida): the value, the required reason, `setOverride`, and
"Remover correção" (`clearOverride`). `overrideValueControl.ts` decides how a value is typed
(a dropdown of flags, statuses or kinds of session, a number, mm:ss, or text) and reads it
back. On the Fontes tables, `CorrectableValue.tsx` is a value's button and mounts
`CorrectableValueMenu.tsx` only once pressed; `overrideLookup.ts` is the one Map of
corrections the tables hand to each cell, so no cell subscribes to the store.
