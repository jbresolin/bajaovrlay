# apps/control/src/features/events

The event inbox (BAJAOVRLAY-44): the console's "Eventos" tab of "Atalhos e macros", and the
"Eventos" page (#/eventos). Start at `EventsTab.tsx` (the waiting events in a capped,
scrolling list, "Som de eventos" and the link to the page) and `EventReviewPage.tsx` (the
waiting events, "+ Evento", "Regras" and the history, `EventHistoryTable.tsx`, searched and
sorted by `eventHistoryView.ts`). Both draw
`WaitingEventsList.tsx`, whose rows (`InboxEventRow.tsx`) have "Prévia", "No ar" and
"Descartar"; the tab's `RecentlyDismissedEvents.tsx` offers "Desfazer" for 30 s after one. The lists are
`inboxEventLists.ts`, the words `inboxEventText.ts`; the forms are `ManualEventDialog.tsx` and
`EventRulesDialog.tsx` with their pure readers (`manualEventForm.ts`, `eventRuleForm.ts`).
The badge's pulse and the chime are `usePendingEventAlert.ts` and `eventChime.ts`; the sound
switch is this browser's own setting (`eventSoundSettingInBrowserStorage.ts`).
`EventMarkOnLayer.tsx` is Camadas' "evento: …" mark. Everything else comes from the server's
`events` and `eventRules` slices.
