# apps/server/src/modules/events

The event inbox (BAJAOVRLAY-44): things that happened once (a penalty given, a new fastest
lap, a leader change, a notice the operator typed) and the rules that put them on air.
Start at `eventDetection.ts`, which watches each accepted poll, runs `detectors/` on the
change and records what they found as `sistema:eventos`; then `reducers/`, one file per
command (show, dismiss, type, change a rule, record), and
`reducers/eventsOfInstancesBookkeeping.ts`, the one rule that moves an event on air and to
shown with the instance carrying it. `eventRunner.ts` puts the events whose rule says auto on air
by itself, with the queue's three rules written next to it. `seedEventRules.ts` holds João's default rules,
`loadEventInboxSlices.ts` the boot, `service.ts` the start and stop. `index.ts` lists what
core may use.
