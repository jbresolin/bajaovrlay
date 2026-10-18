# apps/control/src/i18n

Every word the operator reads on the control page. Start reading at `ptBR.ts`.

- `ptBR.ts` — the pt-BR catalog, grouped by feature. Components take their text from
  here and never write it inline; ESLint refuses literal text in `features/` and `app/`.
- `ptBRKeyboard.ts` (`ptBR.keyboard`: the "?" dialog and each shortcut's words),
  `ptBRQuickFire.ts` (`ptBR.quickFire`: the quick-fire strip, the macros and their editor),
  `ptBRLayers.ts` (`ptBR.layers`), `ptBRQuickEdit.ts` (`ptBR.playout.quickEdit`: "Edição
  rápida") and `ptBRDataSources.ts` (`ptBR.dataSources`: the "Fontes de dados" page and the
  header chip) — parts kept in files of their own so `ptBR.ts` stays readable; reached through
  `ptBR`.
- `formatRelativeTimePtBR.ts` — the one function that writes "há 2 min"-style times.

The product is pt-BR only (docs/00-concept.md §18.5), so there is no language switch and
no second catalog. Messages that come from the server arrive already in pt-BR and are
shown as received.
