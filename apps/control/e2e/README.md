# apps/control/e2e

Browser tests of the control page (Playwright, Chromium). Labels are the manifests' titles. A new item opens with no
graphic chosen ("Escolha um gráfico…") and cannot be saved until one is, so every step that makes a race clock chooses
"Relógio de prova" in "Gráfico" (`chooseGraphicInTheItemEditor` in `previewTestSteps.ts`).

- `outputsAndLayersWalk.e2e.ts` (BAJAOVRLAY-49, the brief's E2E) — "PiP" and its "Moldura" added on "Saídas e camadas"
  (`#/saidas`), a "Tarja" on "Moldura" taken: drawn by `/render/?output=pip`, not by `/render/`; "Excluir" of the layer
  refused while the item names it, done once it is deleted. `emptyTheServerState.ts` removes every output but program.
- `takeAndClear.e2e.ts` (start here) — a page at `/render/` as OBS: "Novo gráfico…" + "Salvar e disparar" ("No ar"
  within 3 s), "Editar" + "Atualizar", reload, "Limpar"; with no OBS the layer stays "Carregando" (the monitor never reports).
- `onAirFromItems.e2e.ts` — everything on air comes from an item: Camadas names the new item; "alterado no ar",
  "Salvar no item", and a new take showing the change. `itemAheadOfTheAir.e2e.ts` (BAJAOVRLAY-38) — the reverse: a
  name saved into a lower third's item puts "item mudou" on its row, and the row's "Atualizar no ar" changes it in place.
- Preview (steps in `previewTestSteps.ts`): `previewThenTake.e2e.ts`, `previewKeyboardLoop.e2e.ts` (→, Space ×3, Backspace),
  `previewTakeWithTomar.e2e.ts`, `autoPreviewAcrossLayers.e2e.ts`, `previewShowsTheResult.e2e.ts` (Prévia = after the take, "Tomar tudo").
- `consoleLayout.e2e.ts` (BAJAOVRLAY-59: at 1920x1080 "Prévia" above "Programa", 640x360, both on screen, the right column
  the widest; at 1366x768 no sideways scroll), `itemUpdateOnAir.e2e.ts` ("Atualizar no ar"),
  `clockStoppedOnAir.e2e.ts` (a stopped clock keeps its time), `rundownTakeWithSpace.e2e.ts` (Space, ←, "Excluir").
- `controlPageTextInTheBundledFace.e2e.ts` (BAJAOVRLAY-71): the page's stack names "Inter Variable" first and the emoji faces
  last; Chromium, asked through the DevTools protocol, drew every Latin text of the console (digits and spaces included) in
  the bundled Inter, none in a face of the machine; the console loads that one file from its own address, no CDN.
- Quick fire (steps in `quickFireTestSteps.ts`): `quickFireWithNumberKey.e2e.ts` (1 fires a button), `macroTakeWaitClear.e2e.ts`
  (take, wait 0,5 s, clear: empty after 0.4–3 s), `macroStopDuringWait.e2e.ts` ("Parar" in a 5 s wait: the clock stays).
- Backup (BAJAOVRLAY-33): `backupDownload.e2e.ts` ("Cópia de segurança" → "Baixar": the saved zip is unzipped in the
  test, its database is whole and holds the "Atalhos" button made before it; "Última cópia" then shows it).
- Login (BAJAOVRLAY-29): `loginRolesWalk.e2e.ts` runs on a second real server with the PINs set
  (`loginServerOfTheBrowserTests.ts`, port 5181, which serves the BUILT page): Dados at "Mesa 2" prepares and edits an
  item, its "Disparar" greyed out with the role's tooltip; "Sair", then the Produtor at "Mesa 1" takes it; the event log
  names `dados:Mesa 2` and `produtor:Mesa 1`. After "Sair" the page's GET /api/v1/state answers 401.
- Undo (BAJAOVRLAY-30): `undoWithCtrlZ.e2e.ts` (two "Atalhos" buttons taken with 1 and 2, then Ctrl+Z: the OBS
  stand-in draws the first one again).

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
  `bajaAppSourcesWalk.e2e.ts` (BAJAOVRLAY-54, the brief's walk): "Adicionar fonte do app Baja" makes 26BR's Enduro, its
  "Geral" table and its Super Prime bracket from a stand-in of the Baja app's API the test serves on a free port
  (`bajaAppTestServer.ts`, the shared fixtures); a tower, a standings board and a bracket open on them (the manifests'
  suggestions) and are taken; the tower follows a changed race answer, car 22 into the lead.
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

- The boards read from Cadastros (BAJAOVRLAY-46): `cadastrosBoardsWalk.e2e.ts` (the brief's walk, three tests): sponsors
  imported from a CSV (one written "master", read as Diamante) and Bosch given a logo, a "Rodízio de patrocinadores" whose
  list is "Lista dos cadastros" ("Valor agora: 1 patrocinador") heads its page "PATROCÍNIO DIAMANTE"; the schedule
  imported from a CSV, a "Contagem regressiva" card whose session and start read the enduro's slot counts down on the
  `clock` layer; a "Programação do dia" on "Lista dos cadastros" shows the three slots in order.

- The podium, the battle card and the QR card (BAJAOVRLAY-47): `podiumBattleQrWalk.e2e.ts` (the brief's walk, three tests,
  on the real program output `/render/`): car 1's team given a logo, a "Pódio" whose teams read the positions through
  "Primeiras N entradas" (3) and "Com logos das equipes", frozen, shows the three cards and car 1's logo after three
  "Próximo" on the Camadas row; a "Disputa de posição" whose eleven fields read the race's first two cars by number, filled by
  two picks (BAJAOVRLAY-66) while the simulator runs at 60×, shows both teams and a gap that follows the race ("+s,d" side by side, "—" if not); a "Cartão de QR" shows a code that scans back to its address. Car 1, not car 7: until the first lap the
  simulator lists its cars by number, so cars 1, 2 and 3 are the podium right after the green flag.
- The elimination bracket (BAJAOVRLAY-25): `bracketStepsWithTheSimulator.e2e.ts` (the brief's walk, on the real program
  output `/render/`): the simulator on seed 2027 with ten cars at 60× run until its Super Prime has a champion (~17 s), and
  left running; a "Chaveamento" whose "Fases" open on "Chaves › Todas as fases" (the manifest's suggestion), live, taken; "Próximo" on the Camadas row from
  "Passo 1 de 5" to "Passo 5 de 5", then off; the output draws the final with car 8 the winner.

- A battle for a place (BAJAOVRLAY-66): `battleCardForSecondPlace.e2e.ts` ("Disputa pela 2ª posição" chosen once, taken: on
  air with positions 2 and 3, the output shows the teams of the cars the simulator lists 2nd and 3rd).
- The item editor during a race (BAJAOVRLAY-45): `itemEditorStaysFastDuringARace.e2e.ts` (a battle card on air whose eleven
  fields read cars 1 and 2 live, the simulator at 60×, opened in the editor with "Campos separados" on for both cars: a path dropdown opens and "Salvar item" registers
  within 2 s each, timed with `performance.now()` around the action; the measured times are on the test's report).

- Triggers (BAJAOVRLAY-48): `httpTriggerFillsTheLowerThird.e2e.ts` (the brief's E2E): an HTTP trigger, set up over the WebSocket, whose
  macro takes a "Tarja" with "Nome" from the trigger's `nome`; a call to `POST /api/v1/triggers/<id>` with `{ "nome": "Ana Souza" }`
  (the run's server has a made-up API token, `triggerCallsOnTheRealServer.ts`) puts "Ana Souza" on air, drawn on `/render/`.
  `triggerFieldsFitTheirBox.e2e.ts`: at 1024×768, a take step's "Dado do gatilho" with a long key stays inside the step's box,
  and the item editor's "Nome" stays inside the editor whichever way it is filled (jsdom measures no layout).

`emptyTheServerState.ts` empties the server before each test, triggers (unpaused), panels, macros, "vai limpar" marks, corrections of a source's values, waiting events and the entity library with its images included, the event rules back to their defaults, and puts the data sources back to the seeded simulator alone, off, not recording, with its default settings (`emptyServerState.e2e.ts` proves it; `emptyServerStateEventInbox.e2e.ts` the event inbox part). `../playwright.config.ts` starts the real server (5187, new SQLite file) and the control dev server (5188); run `pnpm --filter @bajaovrlay/control test:e2e` after `pnpm build`, with nothing left listening on 5187/5188 (a reused server keeps its old database). A second checkout running its browser tests at the same time sets `BAJAOVRLAY_E2E_PORT_OFFSET` (for example 100: 5287/5288), which moves every package's browser-test ports alike; it is read once, in `scripts/e2ePortOffset.ts`, and anything but a whole number counts as 0.
`clockStoppedOnAir.e2e.ts` fails locally when the WSL clock steps (a time sync moves the wall clock); the fix is syncing the Windows clock (Settings → Time & language → Date & time → Sync now), then running `wsl --shutdown` in PowerShell and reopening the terminal, not quarantine.
