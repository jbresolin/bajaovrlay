# apps/server/src/modules/events

The event inbox (BAJAOVRLAY-44): things that happened once (a penalty given, a new fastest
lap, a leader change, a manual notice) and the rules that put them on air. Start at
`detectors/`, the pure functions that find events in a source's new snapshot.
