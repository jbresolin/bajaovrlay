# apps/control/src/features/history

The "Histórico" page, `#/historico` (BAJAOVRLAY-30, concept §7 rule 4): every change of the show
read back in plain pt-BR. Start reading at `HistoryPage.tsx`.

- `HistoryPage.tsx` — the table (time, who, sentence; a refusal in red), "Carregar mais", "Exportar CSV".
- `useHistoryOfTheShow.ts` — the live rows of the `eventLog` slice on top, older pages from
  `GET /api/v1/event-log` below (`fetchOlderEventLogPage.ts`), merged in `historyRows.ts`.
- `HistoryFilters.tsx` — who, type of command, layer, only refusals, free text. The rules and the
  sentences are shared with the server (`@bajaovrlay/shared`, eventLogReading), which runs the
  same filters on the older pages.
- `historyCsv.ts` — the CSV of the rows shown, like Cadastros' (";", UTF-8 with BOM).
- `historyMoments.ts` — "14:32:05" today, "09/10 14:32:05" for an older day.
