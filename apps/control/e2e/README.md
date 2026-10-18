# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Labels are the clock manifest's titles.

- `takeAndClear.e2e.ts` (start here) — a page at `/render/` as OBS: "Novo gráfico…" + "Salvar e disparar" ("No ar"
  within 3 s), "Editar" + "Atualizar", reload, "Limpar"; with no OBS the layer stays "Carregando" (the monitor never reports).
- `onAirFromItems.e2e.ts` — everything on air comes from an item: Camadas names the new item; "alterado no ar",
  "Salvar no item", and a new take showing the change.
- Preview (steps in `previewTestSteps.ts`): `previewThenTake.e2e.ts`, `previewKeyboardLoop.e2e.ts` (→, Space ×3, Backspace),
  `previewTakeWithTomar.e2e.ts`, `autoPreviewAcrossLayers.e2e.ts`, `previewShowsTheResult.e2e.ts` (Prévia = after the take, "Tomar tudo").
- `monitorsSideBySide.e2e.ts` (equal and 16:9 at three widths), `itemUpdateOnAir.e2e.ts` ("Atualizar no ar"),
  `clockStoppedOnAir.e2e.ts` (a stopped clock keeps its time), `rundownTakeWithSpace.e2e.ts` (Space, ←, "Excluir").
- Quick fire (steps in `quickFireTestSteps.ts`): `quickFireWithNumberKey.e2e.ts` (1 fires a button), `macroTakeWaitClear.e2e.ts`
  (take, wait 0,5 s, clear: empty after 0.4–3 s), `macroStopDuringWait.e2e.ts` ("Parar" in a 5 s wait: the clock stays).

- Data sources, on the "Fontes de dados" page `#/fontes` (page steps in `dataSourcesTestSteps.ts`, waits on the server's state in `dataSourceStateOnTheRealServer.ts`; each test reads every 0,5 s and starts
  its race from the green flag with "Reiniciar corrida", and waits on `GET /api/v1/state` with `expect.poll`, never a fixed sleep):
  `simulatorRaceMoves.e2e.ts` (speed 60: 60 cars, the table changes, nothing goes on air), `simulatorFailureKeepsTheData.e2e.ts`
  ("Falha simulada": "Atrasada" with the last data kept over several failed polls, then "Ok" again; a few seconds, never the minute
  that turns it red), `recordAndReplay.e2e.ts` ("Gravar" until the file holds 40 lines, ~20 s; a looping "Reprodução" at 10×),
  `dataSourcesPageLayout.e2e.ts` ("Fontes" opens a new tab; at 1024×768 the positions table scrolls in its box, the page does not),
  `dataSourceCardPicking.e2e.ts` (a click on a greyed-out command does not pick its card; Tab to "Ver", Enter picks it).
  A restart keeps the last data, marked stale: the harness cannot restart its server, so
  `apps/server/src/core/boot/startServerRestart.test.ts` proves it.

`emptyTheServerState.ts` empties the server before each test, panels, macros and "vai limpar" marks included, and puts the data sources back to the seeded simulator alone, off, not recording, with its default settings (`emptyServerState.e2e.ts` proves it). `../playwright.config.ts` starts the real server (5187, new SQLite file) and the control dev server (5188); run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`, with nothing left listening on 5187/5188 (a reused server keeps its old database).
`clockStoppedOnAir.e2e.ts` fails locally when the WSL clock steps (a time sync moves the wall clock); the fix is syncing the Windows clock (Settings → Time & language → Date & time → Sync now), then running `wsl --shutdown` in PowerShell and reopening the terminal, not quarantine.
