# apps/control/src/features/events

The event inbox on the console (BAJAOVRLAY-44): the "Eventos" tab of "Atalhos e macros".
Start at `EventsTab.tsx` (the waiting events with "Prévia", "No ar" and "Descartar", the last
ones that are over, "+ Evento", "Regras" and "Som de eventos"). The lists are
`inboxEventLists.ts`, the words `inboxEventText.ts`; the forms are `ManualEventDialog.tsx` and
`EventRulesDialog.tsx` with their pure readers (`manualEventForm.ts`, `eventRuleForm.ts`).
The badge's pulse and the chime are `usePendingEventAlert.ts` and `eventChime.ts`; the sound
switch is this browser's own setting (`eventSoundSettingInBrowserStorage.ts`).
`EventMarkOnLayer.tsx` is Camadas' "evento: …" mark. Everything else comes from the server's
`events` and `eventRules` slices.
