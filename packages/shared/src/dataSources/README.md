# packages/shared/src/dataSources

Data sources: what the server polls for race data, and what it keeps of it. Start
reading at `dataSource.ts` (the `dataSources` slice: a source, its config by kind and its
health), then `dataSnapshot.ts` (the `dataSnapshots` slice: the last good canonical
shapes of each source, see `../dataShapes/`) and `recording.ts` (the `recordings` slice:
recorded feeds, rebuilt from disk at boot). Each kind's config schema lives here
(`simulatorConfig.ts`, `replayConfig.ts`) so the control page's forms and the server's
adapters check the same thing.

One file per command, named after it; `recordDataSourcePoll.ts` is the one only the
server's poller sends. All are in the `Command` union of `../commands/command.ts`; their
rules live in apps/server/src/modules/dataSources/reducers/. `index.ts` lists every export.
