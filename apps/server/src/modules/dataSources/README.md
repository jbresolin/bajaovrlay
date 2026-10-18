# apps/server/src/modules/dataSources

Data sources: what the server polls for race data (the simulator, a replay of a
recording), the last good snapshot of each, and recordings. Slices and commands are
declared in `packages/shared/src/dataSources/`; this module holds their rules.

Start reading at `reducers/recordDataSourcePoll.ts` (a poll result, the no-op poll, and
which polls stay out of the event log), then `poller.ts` (one loop per source that is
on: rhythm, timeout, stale watch, late answers dropped; `pollResultRecording.ts` turns
an answer into a result and logs it), then `recorder.ts` (the data on screen at "Gravar", then a
recording source's good polls, appended to its file, one line each in the format of
`recordingLine.ts`;
`recordingsFromFolder.ts` lists the files again at boot). `adapters/` holds the
adapters (`adapters/replay/` plays a recording back). `service.ts` starts the poller
and the recorder with the server; `api.ts` is the snapshot REST route. The other
reducers are one file per command (`reducers/reduceDataSourceCommand.ts`); `schema.ts`
checks configs; `loadDataSourceSlices.ts` loads and seeds at boot. Refusals are in
`dataSourceRefusals.ts`, pt-BR texts in `core/messages/ptBR.ts`. `index.ts` lists what
core may use.
