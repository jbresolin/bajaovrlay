# apps/control/e2e/chaos

The chaos suite (BAJAOVRLAY-32): the event-day promise, one failure at a time. When something breaks, the console
says so, the air never blanks or jumps, and nothing an operator did is lost. Each scenario reads like an incident
report: what broke, what the operator sees, what the air shows, what happens when it comes back. Run it before an
event with `pnpm build` then `pnpm test:chaos` (about 4 minutes; `BAJAOVRLAY_E2E_PORT_OFFSET` moves its ports, as for
every browser test). It is part of `pnpm verify` and a CI job of its own.

Every scenario starts its own BUILT server on a new data folder (`faults/serverProcess.ts`, ports in
`steps/chaosPorts.ts`: 5230 and up), so it can kill it and start it again; the console and the output are the pages
that server serves, as on the stream PC. The fault switches live in test support only, never in the server or the
pages: `faults/` holds them, `steps/` the steps the scenarios share. Every scenario imports `test` from
`steps/chaosTest.ts`, whose `startChaosServer` fixture kills its servers when it ends and attaches what they wrote to
the report. The output is watched at every frame: each layer, and the tower's row count. Start reading at
`bajaAppSourceFailures.chaos.ts`.

## The scenarios

Data sources (a tower on air reading the source):

- `bajaAppSourceFailures.chaos.ts` — the Baja app's API goes down: tower kept, "Fontes: 1 atrasada", "fonte atrasada", "Verificar servidor" names it; back: "Ok", no blank frame, one entrance.
- the same — the API answers garbage (HTML): the same.
- the same — the API answers an empty list of cars: the same (it blanked the tower before this suite; fixed in its PR).
- the same — the API answers past its 0,5 s timeout: the same.
- `simulatorFailure.chaos.ts` — "Falha simulada" on and off: the same, for the simulator.

WebSocket (`faults/connectionProxy.ts` between one page and the server):

- `webSocketDrops.chaos.ts` — a take whose answer is lost: applied once; the console, back, says it got no answer and shows the take.
- the same — a take whose command is lost: not applied; the console says it got no answer; the layer is empty.
- the same — the output's link drops with a lower third on air: on air at every frame, no second entrance.
- the same — a console offline for a minute while another operator takes: "Reconectando…", then the take it missed.

Server restart:

- `serverRestart.chaos.ts` — killed (SIGKILL) mid-show and started again: program as it was, the clock kept counting, the preview dropped and the macro not resumed (their documented boot rules), the output never flashed.

Two operators:

- `twoOperators.chaos.ts` — "Próximo" on two consoles at once: one step; the late console says the step had moved.
- the same — a name fixed in the editor while the other operator takes the item: old name on air, "item mudou" on both.
- the same — Produtor takes while Dados edits, on a server with the login: both applied, each named in the log.
- `twoTakesOnOneLayer.chaos.ts` — both take on one layer at once: the first take stays on air with one entrance; the other console's take is refused, and it says why (BAJAOVRLAY-69).

Clock (`faults/fakeNtpForTheServer.ts`):

- `serverClock.chaos.ts` — NTP out of reach: the server starts, "Relógio: sem sincronização — hora do computador.", the clock runs on.
- the same — real time found 30 s ahead with a clock on air: the step is held, the clock does not jump, the header warns.
- the same — "Acertar relógio agora": the confirm says what jumps; only the race clock and the countdown jump, by 30 s.

External services:

- `externalServices.chaos.ts` — OBS closes: "Sem conexão"; takes do not wait; a scene macro stops at step 1; back, it works.
- the same — the Super Chat feed fails (the simulator's; YouTube cannot be faked for a server process): the waiting Super Chats stay, nothing goes on air.

Disk and backup:

- `backupWhileTakes.chaos.ts` — a 100 MB backup downloaded while takes run: takes ran during it, every one applied, none past the 5 s busy timeout, the zip whole.
