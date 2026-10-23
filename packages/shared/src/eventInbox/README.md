# packages/shared/src/eventInbox

The event inbox's shared part (BAJAOVRLAY-44): what an event is, the `events` and
`eventRules` slices, and the five inbox commands. Start at `inboxEvent.ts` (an event as a
detector or the operator makes it), then `inboxEventsSlice.ts` (its statuses),
`eventRule.ts` (ask, auto or ignore per kind; a Super Chat is never auto) and
`eventCommands.ts`. The server's part is apps/server/src/modules/events; this folder is not
named `events` because the server's core/events is the event log.
