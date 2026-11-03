# apps/control/src/features/dataSources

The "Fontes de dados" page (`#/fontes`, opened in a new tab from the console's header) and the
header chip "Fontes: 2 ok · 1 atrasada · 1 com erro" (`DataSourcesHealthChip.tsx`). Start at
`DataSourcesPage.tsx`. The server polls the sources; the page only sends commands and shows
the slices it is sent. Nothing here reaches the air.

- `DataSourceRow.tsx`, `DataSourceStatusChip.tsx` — one source, as a card that shows its data on a
  click anywhere but its controls, and on "Ver" (keyboard): chip, switch, "Atualizar agora",
  "Reiniciar corrida" (simulators), "Gravar" / "Parar gravação", "Editar", two-press "Excluir";
  `dataSourceHealth.ts` says "Ok", "Atrasada", "Erro" or "Desligada" from the server's status
  plus one page rule: failing for 60 s since the server's `failingSinceMs` is red "Erro"
  (pure, table test).
- `SimulatorSourceForm.tsx`, `ReplaySourceForm.tsx` — the per-kind forms, read by
  `simulatorSourceForm.ts` / `replaySourceForm.ts` with the shared config schemas; the flex
  HTTP/JSON form, its "Testar" panel and import / export are in `flexSource/` (its README);
  `bajaAppSource/` (its README) is "Adicionar fonte do app Baja", which opens the flex form
  at a Baja app preset (BAJAOVRLAY-54);
  `dataSourceCommandsFromForm.ts` builds create / update-with-only-changes (pure);
  `recordingsOfferedForReplay.ts` lists the ended recordings newest first.
- `DataSourceDetail.tsx` — the selected source's data: `SessionCard.tsx` (`useSessionClockText.ts`,
  the race clock's shared sum), the positions and standings tables (`timingScreenText.ts`: lap
  times in ms, "4:38.293", João's call for a diagnostic screen; gaps to the tenth, cut), the
  stale banner and the raw JSON. Times count on the server's clock (`useServerAlignedTimeMs.ts`).
  The tables and the card show the operator's corrections laid over the data, and a team,
  school, status, points, event, session name, flag or laps can be corrected from there
  (`features/overrides/CorrectableValue.tsx`, BAJAOVRLAY-20).

## Fontes do app Baja

"+ Fonte" → "Adicionar fonte do app Baja" (BAJAOVRLAY-54; the operator's guide is
`docs/bajaAppSources.md`). The event id is the Baja app's own, as in its results address
(`?evt=26BR`). A lap-counted race feeds the session and positions (the clock, the flag, the
tower), a results table the standings, a tournament the brackets. On Fontes, "Resultado com
spoilers ativos…" means the organisers hide the table for now, and "Corrida em modo
simulação…" that the app marks the race as a test, refused unless the source was made with
"Aceitar corrida simulada", and "Estado de corrida desconhecido…" that the app sent a race
state the preset does not know (a line to add to the preset); either way the source reads
"Atrasada" and keeps what is on air. "Outro resultado (digite o id)" reads a result the
event's menu leaves out (26BR's Super Prime), as a table or, when the API says `wrong_type`,
as a tournament.
