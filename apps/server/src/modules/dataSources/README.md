# apps/server/src/modules/dataSources

Data sources: what the server polls for race data (the simulator, a replay of a recording,
a flex HTTP/JSON source) and for Super Chats (a YouTube live's chat, BAJAOVRLAY-35), the last
good snapshot of each, and recordings. Slices and commands are declared in
`packages/shared/src/dataSources/`; this module holds their rules (concept §4 and §8).

Start at `reducers/recordDataSourcePoll.ts` (a poll result, and which polls stay out of
the event log), then `poller.ts` (one loop per source that is on: rhythm, timeout, stale
watch), then `recorder.ts` (good polls appended to the recording file), then
`adapters/httpJson/README.md` for the flex source. The other command reducers are in
`reducers/` (its README says where to start); `service.ts` starts poller and recorder,
`api.ts` holds the routes, and `index.ts` lists what core may use. For a flex source end
to end, read `flexSourceThroughTheStore.test.ts`; for BAJAOVRLAY_SOURCE_ALLOWED_HOSTS (the
hosts a flex source may fetch), `adapters/httpJson/sourceHostAllowlist.ts`. For the YouTube
source, `adapters/youtubeLiveChat/README.md`; that its key never leaves the request,
`youTubeKeyNeverAppears.test.ts`.
