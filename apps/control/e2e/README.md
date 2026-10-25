# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Labels are the manifests' titles. A new item opens with no
graphic chosen ("Escolha um gráfico…") and cannot be saved until one is, so every step that makes a race clock chooses
"Relógio de prova" in "Gráfico" (`chooseGraphicInTheItemEditor` in `previewTestSteps.ts`).

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
  `dataSourceCardPicking.e2e.ts` (a click on a greyed-out command does not pick its card; Tab to "Ver", Enter picks it),
  `flexSourceFollowsATimingSystem.e2e.ts` (the example preset imported into "HTTP/JSON (flexível)", pointed at an imaginary
  timing system the test serves on a free port, `timingSystemTestServer.ts`: "Testar" shows 20 cars; saved and on, the table
  follows a changed answer, keeps its data "Atrasada" while the timing system answers 500, and is "Ok" again after).
  `bindingsFollowTheSimulator.e2e.ts` (BAJAOVRLAY-20, the brief's walk): a race clock whose title and flag read the
  simulator and whose time is "Relógio da fonte" goes on air with the simulator's state, turns yellow by itself at the seeded race's
  first yellow (seed 1405, set with the speed: 16 simulated minutes in, ~16 s at 60×), takes a correction of the session name ("Corrigir valor da fonte…") and
  loses it again, and shows "fonte atrasada" on its Camadas row with "Falha simulada" on, its data still on air (read from
  `GET /api/v1/state`).
  `bugStripTickerWalk.e2e.ts` (BAJAOVRLAY-23, the brief's walk, three tests): the simulator's teams imported and the
  simulator on; a strip from "Novo gráfico…" with "Carros" already on "Fonte", its time on "Relógio da fonte" and its flag
  on the session's: 60 cars and a running clock on the `ticker` layer, six pills, "1/10" and the time in the monitor; a
  sponsor typed with its logo on the light plate and a bug reading both: the logo on its plate under "Apresentado por";
  a ticker of two typed messages, a third added with "Adicionar mensagem" and "Atualizar no ar": the same instance, "1/3".
  `towerFollowsTheSimulator.e2e.ts` (BAJAOVRLAY-21/22, the brief's E2E, three tests; the monitor-frame finders and the box
  measure in `towerInProgramMonitor.ts`): the simulator at 60×, "Novo gráfico…" with
  "Torre de posições" opens with "Carros" already on "Fonte" (the manifest's suggestion), "Só os 20 primeiros", "Salvar e disparar":
  20 rows in the "Programa" monitor (the rows inside the element's shadow root) and 60 cars on the `tower` layer; the rows swap
  by themselves once the simulator's first 20 places change (waited on `GET /api/v1/state`, up to 60 s); "Editar" of its "Atalhos"
  button, "Leiaute" "Detalhada", "Atualizar no ar": the same instance id, the "DIF." caption; a race clock taken too sits above the
  tower in the same column (bounding boxes inside the frame, compared with each other only).
  A restart keeps the last data, marked stale: the harness cannot restart its server, so
  `apps/server/src/core/boot/startServerRestart.test.ts` proves it.

- The event inbox (BAJAOVRLAY-44; commands and state reads in `eventInboxOnTheRealServer.ts`): `eventInboxWithTheSimulator.e2e.ts`
  (the simulator at 60× on seed 227, whose first penalty comes 3 simulated minutes in: the penalty waits in "Eventos" with nothing on
  the notice layer, "No ar" shows it for its rule's 2 s; a fastest lap goes on air by itself) and `eventInboxAfterARestart.e2e.ts`
  (a server of its own on 5189, stopped and started again on its SQLite file: nothing listed before is listed again, nothing is
  replayed). `eventsTabKeepsTheLayersOnScreen.e2e.ts` (eight typed penalties waiting: Camadas stays on screen at 1600×900 and the
  tab's list scrolls).

- The entity library, on "Cadastros" `#/cadastros` (steps and a real PNG in `entityLibraryTestSteps.ts`):
  `entityLibraryWalk.e2e.ts` (BAJAOVRLAY-19, the brief's walk, three tests): "Importar equipes do simulador" lists 100 teams;
  a logo uploaded on car 7's form shows and is served as a PNG; a race clock from "+ Item" with its title on "Cadastro" ›
  Equipe › car 7 › "Nome da equipe", "Salvar e disparar": the title on air is "Juriti Off-Road", and renamed on Cadastros it
  follows by itself; the team deleted, the rundown row says "cadastro · não entra agora" naming the car while the air keeps
  its title; an SVG with a script opened at `/media/<id>` runs nothing (no dialog, the CSP header).

- The lower third, the team card and the standings (BAJAOVRLAY-24): `lowerThirdTeamCardStandingsWalk.e2e.ts` (the brief's walk,
  three tests): car 7 of the simulator's teams given a logo with "Logo sobre placa clara" ticked, and a "Cartão de equipe"
  whose every field reads car 7 in Cadastros shows "Joinville · SC" and the logo on its plate in the "Programa" monitor; a
  "Tarja" reading a person typed on Pessoas shows the name and the role; a "Classificação" whose "Equipes" and "Partes da
  pontuação" open on the simulator (the manifest's suggestions) shows 20 rows under the six parts. The page turn is the
  standings package's component test (fake time), never a 10 s wait here.

`emptyTheServerState.ts` empties the server before each test, panels, macros, "vai limpar" marks, corrections of a source's values, waiting events and the entity library with its images included, the event rules back to their defaults, and puts the data sources back to the seeded simulator alone, off, not recording, with its default settings (`emptyServerState.e2e.ts` proves it; `emptyServerStateEventInbox.e2e.ts` the event inbox part). `../playwright.config.ts` starts the real server (5187, new SQLite file) and the control dev server (5188); run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`, with nothing left listening on 5187/5188 (a reused server keeps its old database). A second checkout running its browser tests at the same time sets `BAJAOVRLAY_E2E_PORT_OFFSET` (for example 100: 5287/5288), which moves every package's browser-test ports alike; it is read once, in `scripts/e2ePortOffset.ts`, and anything but a whole number counts as 0.
`clockStoppedOnAir.e2e.ts` fails locally when the WSL clock steps (a time sync moves the wall clock); the fix is syncing the Windows clock (Settings → Time & language → Date & time → Sync now), then running `wsl --shutdown` in PowerShell and reopening the terminal, not quarantine.
