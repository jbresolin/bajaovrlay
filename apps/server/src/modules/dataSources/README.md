# apps/server/src/modules/dataSources

Data sources: what the server polls for race data (the simulator, a replay of a
recording), the last good snapshot of each, and recordings. The slices and commands are
declared in `packages/shared/src/dataSources/`; this module holds their rules.

Start reading at `reducers/recordDataSourcePoll.ts` (the heart: a poll result, good or
failed, the no-op poll, and which polls stay out of the event log), then the other
reducers, one file per command, dispatched by `reducers/reduceDataSourceCommand.ts`.
`schema.ts` checks a config against its kind's schema; `dataSourceTimeline.ts` starts a
source's timeline when it is turned on and carries it through an edit; `recordingBookkeeping.ts` keeps the `recordings`
slice; `loadDataSourceSlices.ts` loads the slices at boot and seeds the simulator
(`seedDataSources.ts`). Refusals are in `dataSourceRefusals.ts`, their pt-BR texts in
`core/messages/ptBR.ts`. `index.ts` lists what core may use.
