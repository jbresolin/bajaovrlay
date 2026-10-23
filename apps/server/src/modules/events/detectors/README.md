# apps/server/src/modules/events/detectors

The detectors of the event inbox (BAJAOVRLAY-44): pure functions that compare a source's
previous accepted snapshot with its new one and list what happened once in between. Start at
`detectEventsBetweenSnapshots.ts`, which runs them all and makes a missing shape or a new
session a baseline (nothing fires). Each detector is one file: `newIncident.ts` (an incident id
not listed before), `newFastestLap.ts` (the session's best lap improved) and
`leaderChanged.ts` (another car in 1st place). Event ids are deterministic, built from what
happened (the source, the incident id, or the session, car and lap), never from when.

Detectors kept for later, each a new file and one line in `detectEventsBetweenSnapshots.ts`:
**flag changed** (the session's `state` differs: a yellow, a red, the checkered flag) and
**session finished** (`state` becomes `finished`).
