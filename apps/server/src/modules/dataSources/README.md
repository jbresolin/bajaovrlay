# apps/server/src/modules/dataSources

Data sources: what the server polls for race data (the simulator, a replay of a recording),
the last good snapshot of each, and recordings. Slices and commands are declared in
`packages/shared/src/dataSources/`; this module holds their rules (concept §4 and §8).

Start at `reducers/recordDataSourcePoll.ts` (a poll result, the no-op poll, which polls stay
out of the event log), then `poller.ts` (one loop per source that is on: rhythm, timeout,
stale watch; `pollResultRecording.ts` turns an answer into a result), then `recorder.ts`
(good polls appended as lines of `recordingLine.ts`; `recordingsFromFolder.ts` lists the
files at boot). `adapters/` holds the simulator and the replay. `service.ts` starts poller
and recorder; `api.ts` is the snapshot REST route; the other reducers are one file per
command (`reducers/reduceDataSourceCommand.ts`); `loadDataSourceSlices.ts` loads and seeds
at boot. Refusals are in `dataSourceRefusals.ts`, pt-BR texts in `core/messages/ptBR.ts`;
`index.ts` lists what core may use.
