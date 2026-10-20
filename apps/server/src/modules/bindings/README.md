# apps/server/src/modules/bindings

Bindings on air (concept §5, BAJAOVRLAY-20): keeping the item fields that read a data source
current while their instance is on air or in preview, and the operator's corrections of a
source (overrides). Reading a binding is shared code
(`packages/shared/src/bindings/`); the take and preview resolve items in core
(`core/store/resolveItemFields.ts`) and write each instance's bindings to the
`instanceBindings` slice (`core/store/reducers/instanceBindingsBookkeeping.ts`).

Start at `liveRefresher.ts`: after a snapshot changes it asks `liveFieldsRefresh.ts` what
each bound instance should now show, and sends `refreshBoundInstanceData` as
`sistema:vinculos`; `reducers/refreshBoundInstanceData.ts` applies it through
updateInstanceData's steps, never marking "alterado no ar" and writing no event-log row.
A refresh refused as a whole is retried in parts (`reducers/refreshSplitIntoParts.ts`),
and the refused keys are kept on the instance's entry, which logs one failed row per spell. The operator's corrections are
`reducers/setOverride.ts` and `reducers/clearOverride.ts` (the `overrides` slice, shapes in
`packages/shared/src/overrides/`); the refresher rewrites the air when they change.
`service.ts` starts the refresher with the server, and `index.ts` lists what core may use.
