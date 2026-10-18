# apps/control/src/features/dataSources

The "Fontes de dados" page (`#/fontes`) and the header chip "Fontes: 2 ok · 1 atrasada"
(`DataSourcesHealthChip.tsx`). Start at `DataSourcesPage.tsx`. The server polls the sources; the
page only sends commands and shows the slices it is sent. Nothing here reaches the air.

- `DataSourceRow.tsx`, `DataSourceStatusChip.tsx` — one source: chip, switch, "Atualizar agora",
  "Gravar" / "Parar gravação", "Editar", two-press "Excluir"; `dataSourceHealth.ts` says "Ok",
  "Atrasada", "Erro" or "Desligada" from the server's status (pure, table test).
- `SimulatorSourceForm.tsx`, `ReplaySourceForm.tsx` — the per-kind forms, read by
  `simulatorSourceForm.ts` / `replaySourceForm.ts` with the shared config schemas;
  `dataSourceCommandsFromForm.ts` builds create / update-with-only-changes (pure).
- `DataSourceDetail.tsx` — the selected source's data: `SessionCard.tsx` (`useSessionClockText.ts`,
  the race clock's shared sum), the positions and standings tables (`timingScreenText.ts`), the
  stale banner and the raw JSON. Times count on the server's clock (`useServerAlignedTimeMs.ts`).
