# apps/server/src/modules/triggers

Triggers (BAJAOVRLAY-48): rules that run a macro when an OBS scene is entered or left, an
HTTP call arrives, an inbox event is recorded, or a moment of the schedule comes. Start at
`service.ts`, which watches the store and the clock and sends `fireTrigger` as
`sistema:gatilhos`; then `reducers/fireTrigger.ts`, which decides through
`whenATriggerMayFire.ts` (on, not paused, interval, an interval trigger's item still on air,
and the two rules against loops, written there) and runs the macro or makes the firing wait.
`obsSceneChanges.ts`, `dataEventsOfTheInbox.ts` and `scheduleMoments.ts` (with every N minutes,
BAJAOVRLAY-64, counted from the switch-on `reducers/triggerEditing.ts` stamps) turn what
happened into a firing's data. `httpTriggerCalls.ts` handles `POST /api/v1/triggers/:triggerId`
(route in api/v1/triggerRoute.ts); `reducers/triggerFiringAnswers.ts` holds "Rodar",
"Descartar" and "Desfazer"; `index.ts` lists what core may use. The activity keeps the newest
50 firings (`reducers/triggerActivityChanges.ts`), never dropping one that waits.
