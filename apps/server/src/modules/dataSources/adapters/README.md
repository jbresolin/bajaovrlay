# apps/server/src/modules/dataSources/adapters

An adapter reads one kind of data source (the simulator, a replay of a recording) and
answers a poll with the canonical shapes (session, positions, standings, brackets). It
never writes state: the poller hands its answer to the store.

Start reading at `dataSourceAdapter.ts` (what every adapter promises: pollOnce, the
AbortSignal it must honour, the shapes it produces), then `createDataSourceAdapters.ts`
(the adapters the server registers, and how a source is polled with the one of its
kind). Each kind gets its own subfolder here (`replay/`, `simulator/`) with its tests.
