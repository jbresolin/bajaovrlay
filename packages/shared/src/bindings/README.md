# packages/shared/src/bindings

Bindings: an item field that reads its value from a data source instead of holding a typed
one (concept §2 and §5, BAJAOVRLAY-20). Start at `bindingFieldValue.ts` (what a binding
stores: source, shape, path, car number, live or frozen, up to two transforms in order), then
`bindingProblems.ts` (whether its parts make sense together) and
`bindingFitsGraphicField.ts` (which value types fit a graphic's field, read from the
manifest schema, and the four clock fields found by role for the clock group);
`itemFieldsReadFromASource.ts` lists the fields an item reads, which "Salvar no item" and
"Tomar" leave to the source.

Everything here is pure and runs alike on the server (when an item is saved, and at the
take) and in the item editor (before sending). `bindingResolution.ts` hands the transforms
the library's teams, which every caller passes (withTeamLogos, BAJAOVRLAY-47). The paths a binding may name, with their
labels and value types, live with the shapes in `../dataShapes/bindablePaths.ts`; the
pt-BR sentences in `ptBRBindings.ts`. `index.ts` lists every export.
