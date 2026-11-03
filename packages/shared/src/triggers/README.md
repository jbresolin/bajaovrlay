# packages/shared/src/triggers

Triggers (BAJAOVRLAY-48): rules that run a macro when something outside the operator's
hands happens: an OBS scene entered or left, an HTTP call, an inbox event, a time of the
schedule. Start at `trigger.ts`: what a trigger waits for (`when`), its macro, its mode
(auto or ask) and its minimum interval. `triggerData.ts` is the flat data a firing
carries, and the check of an HTTP trigger's body. `triggerActivity.ts` is the in-memory
slice: the pause, each trigger's last firing, and the firings that ask the operator.
`triggerDataField.ts` is a take step's field filled from that data. `triggerCommands.ts`
holds the eight commands; their rules live in apps/server/src/modules/triggers/.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
