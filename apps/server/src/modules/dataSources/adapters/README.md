# apps/server/src/modules/dataSources/adapters

An adapter reads one kind of data source (the simulator, a replay of a recording, a flex
HTTP/JSON source, a YouTube live's chat) and answers a poll with the canonical shapes
(session, positions, standings, brackets, incidents, superChats). It never writes state:
the poller hands its answer to the store.

Start reading at `dataSourceAdapter.ts` (what every adapter promises: pollOnce, the
AbortSignal it must honour, the shapes it produces, and the optional prepareForPolling
the poller calls when a source is turned on or its config changes), then
`createDataSourceAdapters.ts` (the adapters the server registers, and how a source is
polled with the one of its kind). Each kind gets its own subfolder here (`replay/`,
`simulator/`, `httpJson/`, `youtubeLiveChat/`) with its tests.
