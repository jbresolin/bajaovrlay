# apps/control/src/features/triggers

Triggers (BAJAOVRLAY-48): rules on the server that run a macro when an OBS scene is entered
or left, an HTTP call arrives, an inbox event is recorded or a schedule time comes. Start at
`TriggersDialog.tsx`, "Gatilhos" beside "Regras" on the "Eventos" page: the list in words
(`triggerText.ts`) and the editor (`TriggerEditor.tsx`, with the kind's controls in
`TriggerWhenControls.tsx` and an HTTP trigger's address and curl in `HttpTriggerAddress.tsx`).
The editor's values become createTrigger or updateTrigger in `triggerForm.ts`, pure.
Firings that ask are drawn in the "Eventos" tab and page by `WaitingTriggerFirings.tsx`
(rows in `TriggerFiringRow.tsx`: "Rodar", "Descartar") and `RecentlyDismissedTriggerFirings.tsx`
("Desfazer" for 30 s); the lists are `triggerFiringLists.ts`. `TriggersPausedChip.tsx` is
"Gatilhos e eventos automáticos pausados" in the header while paused, with "Retomar" (the
pause holds the automatic events too, BAJAOVRLAY-73); pausing is an entry of the header's
menu (features/headerMenu). A take step's "Dado do gatilho" lives with the macro editor
(features/macros/TakeStepTriggerFields.tsx). Everything is read from the `triggers` and
`triggerActivity` slices; the page only sends commands.
