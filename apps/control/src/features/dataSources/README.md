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
  `dataSourceCommandsFromForm.ts` builds create / update-with-only-changes (pure);
  `recordingsOfferedForReplay.ts` lists the ended recordings newest first.
- `DataSourceDetail.tsx` — the selected source's data: `SessionCard.tsx` (`useSessionClockText.ts`,
  the race clock's shared sum), the positions and standings tables (`timingScreenText.ts`, gaps
  to the tenth, cut), the stale banner and the raw JSON. Times count on the server's clock
  (`useServerAlignedTimeMs.ts`).
