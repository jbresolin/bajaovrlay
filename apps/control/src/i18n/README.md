# apps/control/src/i18n

Every word the operator reads on the control page. Start reading at `ptBR.ts`.

- `ptBR.ts` — the pt-BR catalog, grouped by feature. Components take their text from
  here and never write it inline; ESLint refuses literal text in `features/` and `app/`.
- `formatRelativeTimePtBR.ts` — the one function that writes "há 2 min"-style times.

The product is pt-BR only (docs/00-concept.md §18.5), so there is no language switch and
no second catalog. Messages that come from the server arrive already in pt-BR and are
shown as received.
