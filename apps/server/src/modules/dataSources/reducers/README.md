# apps/server/src/modules/dataSources/reducers

The rules of the data-source commands: one pure reducer per command, named after it, each
with its test beside it. A reducer takes the slices and a command and hands back the new
slices or a pt-BR refusal; it never touches the database, a timer or a file (the store,
the poller and the recorder do that around it).

Start at `reduceDataSourceCommand.ts`, the switch core's reduceCommand calls for the ten
data-source commands. Then `recordDataSourcePoll.ts` (the poller's result: snapshot,
health, the no-op repeat) and `setDataSourceEnabled.ts` (turning on starts the timeline).
`restartSimulatedRace.ts` is "Reiniciar corrida". Shared refusals are in
`../dataSourceRefusals.ts`; the timeline starts in `../dataSourceTimeline.ts`.
`dataSourceSlices.testSupport.ts` builds the race-day slices every test here starts from.
