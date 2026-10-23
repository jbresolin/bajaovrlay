# apps/control/src/i18n

Every word the operator reads on the control page. Start reading at `ptBR.ts`.

- `ptBR.ts` — the pt-BR catalog, grouped by feature. Components take their text from
  here and never write it inline; ESLint refuses literal text in `features/` and `app/`.
- `ptBRKeyboard.ts` (`ptBR.keyboard`: the "?" dialog and each shortcut's words),
  `ptBRQuickFire.ts` (`ptBR.quickFire`: the quick-fire strip, the macros and their editor),
  `ptBRLayers.ts` (`ptBR.layers`), `ptBRQuickEdit.ts` (`ptBR.playout.quickEdit`: "Edição
  rápida") and `ptBRDataSources.ts` (`ptBR.dataSources`: the "Fontes de dados" page and the
  header chip; its flex HTTP/JSON form in `ptBRFlexSourceForm.ts`, `ptBR.dataSources.flexForm`)
  and `ptBREvents.ts` (`ptBR.events`: the event inbox) — parts kept in files of their own so
  `ptBR.ts` stays readable; reached through `ptBR`.
- `formatRelativeTimePtBR.ts` — the one function that writes "há 2 min"-style times.
- `timeOfDayText.ts` — moments as the operator reads them: "15:44:00" and
  "19/03/2027, 10:00" (moved here from features/dataSources at gate 2 of PR #22's walk
  changes, now that the event inbox writes them too).
- `textForSearch.ts` — text as every search on the page compares it: lower case, no accents.

The product is pt-BR only (docs/00-concept.md §18.5), so there is no language switch and
no second catalog. Messages that come from the server arrive already in pt-BR and are
shown as received.
