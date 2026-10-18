# apps/server/src/modules/dataSources

Data sources: what the server polls for race data (the simulator, a replay of a recording,
a flex HTTP/JSON source), the last good snapshot of each, and recordings. Slices and
commands are declared in `packages/shared/src/dataSources/`; this module holds their rules
(concept §4 and §8).

Start at `reducers/recordDataSourcePoll.ts` (a poll result, the no-op poll, which polls
stay out of the event log), then `poller.ts` (one loop per source that is on: rhythm,
timeout, stale watch; preparing a source in `sourcePreparation.ts`; the 10 s ceiling it
shares with the sample route in `pollTimeouts.ts`), then `recorder.ts`
(good polls appended as numbered lines of `recordingLine.ts`, the count reported once
written; caps in `recordingCaps.ts`) and `recordingsFromFolder.ts` (the list at boot,
from each file's two ends). `adapters/` holds the simulator, the replay and httpJson
(start at `adapters/httpJson/README.md` for a flex source); `service.ts` starts poller and
recorder; `api.ts` holds the snapshot route and the flex sample route ("Buscar da fonte"); one reducer file per command
in `reducers/` (its README says where to start). `loadDataSourceSlices.ts` loads and
seeds at boot. Refusals are in `dataSourceRefusals.ts`; `index.ts` lists what core may use.
