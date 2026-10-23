# apps/server/src/modules/bindings

Bindings on air (concept §5, BAJAOVRLAY-20): keeping the item fields that read a data source
current while their instance is on air or in preview, and the operator's corrections of a
source (overrides). Reading a binding is shared code (`packages/shared/src/bindings/`); the
take resolves items in core (`core/store/resolveItemFields.ts`) and writes each instance's
bindings to `instanceBindings` (`core/store/reducers/instanceBindingsBookkeeping.ts`).

Start at `liveRefresher.ts`: after a snapshot, an override or the entity library changes it
asks `liveFieldsRefresh.ts` (and `liveEntityFieldsRefresh.ts`, BAJAOVRLAY-19) what each
instance should show, and sends `refreshBoundInstanceData` as `sistema:vinculos`;
`reducers/refreshBoundInstanceData.ts` applies it through updateInstanceData's steps, with no
"alterado no ar" and no event-log row, retrying a refused one in parts
(`reducers/refreshSplitIntoParts.ts`). `reducers/setOverride.ts` and `clearOverride.ts` keep
the `overrides` slice; `service.ts` starts the refresher, `index.ts` lists what core may use.
