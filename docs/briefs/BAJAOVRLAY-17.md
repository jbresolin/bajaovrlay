# Agent brief — BAJAOVRLAY-17 (+39, +41): data sources, canonical shapes and the race simulator

**Branch:** `BAJAOVRLAY-17-data-sources-and-simulator` off an up-to-date `main`. **One PR** that covers three Plane items: BAJAOVRLAY-39 (canonical data shapes), BAJAOVRLAY-17 (data source framework, recorder, replayer) and BAJAOVRLAY-41 (simulated feeds). Left open for João's review. Do not merge. This is a long task. Work through it in the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**Read first:**

- `CLAUDE.md`, all of it (readability law, testing policy, architecture rules 1–5);
- `docs/00-concept.md` §3.1, §4 (dataSources, overrides, commands; the authorize rules for `sistema:` actors), §5, §7 rule 8, §8, §14;
- `docs/decisions.md`, at least everything from PR #12 on;
- `docs/testing-style.md`;
- `apps/server/src/core/store/` (command path, authorize hook, persistence, no-op rule), the macro runner and auto-out as examples of server-side actors with injectable clocks;
- `apps/server/src/core/ws/` (hello, slice and slices messages);
- `packages/shared/src/` (how slices, commands and WS messages are declared);
- `packages/graphics/race-clock/race-clock.ograf.json` (its flag `state` enum and clock fields, which the session shape reuses).

## Why

M2 makes graphics show real data. The scoring app is the main source, but its REST endpoints are being built elsewhere (the Baja App project), and João wants our side flexible enough to take any source. So this PR builds everything on our side that does not depend on anyone else:

1. **Canonical shapes.** What session, positions, standings and brackets look like _inside_ BajaOvrLay. Every source produces these, and graphics bind only to them. The Baja app, a spreadsheet or another timing system later becomes a configuration that maps into them (BAJAOVRLAY-40, flex source, next brief).
2. **The framework.** Sources are polled, the last good snapshot is kept, a failure marks it stale and never blanks it (rule 4), and feeds can be recorded and replayed (rehearsal mode, §7 rule 8).
3. **A simulator.** A source that produces a realistic, deterministic Baja enduro (about 60 cars lapping, positions changing, pit stops, breakdowns, flags, the session clock, standings). The next graphics (positions tower, standings, team card) are built and rehearsed against it, and nobody types data in.

Nothing on air changes in this PR: bindings from item fields to sources are BAJAOVRLAY-20. The operator sees sources and their data on a new page; graphics don't read them yet.

## Deliverable

### A. Canonical data shapes (packages/shared) — BAJAOVRLAY-39

New folder `packages/shared/src/dataShapes/`, one file per shape, a README, and a `samples/` folder with realistic sample payloads (JSON) that are also used as test fixtures.

Common conventions:

- Times are milliseconds: durations as integers (`lastLapMs`); moments as wall-clock ms since 1970 (`updatedAtMs`), the server's clock.
- A car is identified by `carNumber` (integer). Every entry repeats `carNumber`, `teamName` and `schoolName` (the university, short form like "UFPR"), so a graphic never has to join tables. The entity library (BAJAOVRLAY-19) will add logos and photos later by `carNumber`.
- Every shape has `updatedAtMs` (when the source produced it) and a `sessionId` where it belongs to one session.
- Optional means "the source doesn't know", never a placeholder value. No `0` for "unknown".

Shapes (names are the real field names; adjust only if something here contradicts existing code, and record why):

- **session**: `sessionId`, `eventName` ("Baja SAE Brasil 2027 — Etapa Nacional"), `sessionName` ("Enduro de Resistência"), `sessionKind` (enum: `enduro`, `acceleration`, `speed`, `traction`, `suspension`, `maneuverability`, `other`), `state` (**reuse the race clock manifest's `state` enum values exactly**, so a binding can feed the clock's flag with no transform), `clock` (`mode`, `referenceTimeMs`, `referenceWallClockMs`, `running`, **the same names and meanings as the race clock's fields**), `scheduledDurationMs` (optional), `lapsCompletedByLeader` (optional), `updatedAtMs`.
- **positions**: `sessionId`, `updatedAtMs`, `entries[]`, ordered by `position`. Each entry:
  - identity and place: `position`, `carNumber`, `teamName`, `schoolName`;
  - laps and times: `laps`, and optionally `lastLapMs`, `bestLapMs`, `gapToLeaderMs` or `gapToLeaderLaps` (exactly one when not the leader; neither for the leader), `intervalMs`, `pitStops`;
  - `status` (enum: `running`, `inPit`, `stopped`, `retired`, `disqualified`, `notStarted`).
- **standings**: `scope` (`overall` or a `sessionKind`), `updatedAtMs`, `entries[]` ordered by `rank`. Each entry: `rank`, `carNumber`, `teamName`, `schoolName`, `points` (number), and optionally `pointsByEvent` (map from sessionKind to number).
- **brackets** (draft; BAJAOVRLAY-25 will refine it against the Baja app's `tournament` table): `sessionId`, `updatedAtMs`, `rounds[]`, each with `name` ("Quartas de final") and `matches[]`. Each match: `matchId`, `carA`, `carB` (each `carNumber`, `teamName`, `schoolName`, optional `timeMs`), optional `winnerCarNumber`. Mark it draft in the README.

Also in `dataShapes/`:

- `DataShapeKey` (`session`, `positions`, `standings`, `brackets`) and one function that validates a payload for a key, returning a pt-BR error naming the path on failure.
- `listBindablePathsOfShape(shapeKey)`: the paths a binding may point at, each with a pt-BR label ("Posições › 1º colocado › Equipe"), derived plainly from the schema. Hand-list them if deriving from Zod would need clever type code; the readability law wins. BAJAOVRLAY-20's picker will read this. A test fixes the list.
- Samples: `session.enduro-green.json`, `session.enduro-yellow.json`, `positions.enduro-lap-34.json` (60 cars, some in the pit, one retired, gaps in ms and in laps), `standings.overall.json`, `brackets.suspension.json`. They read like the real thing: plausible team names, car numbers, lap times around 4–7 minutes for an enduro lap.

### B. Data source framework (shared + server) — BAJAOVRLAY-17

**Module:** `apps/server/src/modules/dataSources/` (schema.ts, service.ts, api.ts, index.ts, README.md), with `adapters/<kind>/` folders. Follow the existing module layout and public-surface rules.

**Adapter interface.** One file states it. Each adapter has:

- a `kind`;
- a Zod `configSchema`;
- `listProducedShapes(config)`, returning which canonical shapes it produces;
- `pollOnce(config, context)`, which resolves to `{ shapes: Partial<Record<DataShapeKey, payload>> }` or throws. The context holds an injectable clock and an AbortSignal for the timeout.

The framework validates every produced payload against its canonical schema. An invalid payload is a failed poll, with the pt-BR path error as `lastError`. A poll never half-succeeds: either every produced shape validates or none is accepted. Kinds in this PR are `simulator` (part C) and `replay` (below).

**State (new slices in shared):**

- `dataSources`: per source `id`, `label`, `kind`, `config`, `pollIntervalMs` (500–60 000), `isEnabled`, `isRecording`, and `status`:
  - `lastAttemptAtMs`, `lastOkAtMs`, `lastError`, `consecutiveFailures`;
  - `isStale`: true when the last attempt failed, or when there has been no success within `staleAfterMs` (default 3 × poll interval). A disabled source is not stale; it is off.

  Persisted.

- `dataSnapshots`: per source id, `receivedAtMs` and the last good shapes. **Persisted**, so a server restart keeps the last good data (marked stale until the next successful poll; rule 4).

The renderer has no use for snapshots (graphics get resolved data only, rule 3), and 60-car snapshots every two seconds are a frame-drop risk in OBS. Renderer connections therefore do not receive `dataSnapshots`. If the hub sends every slice to every client today, add the smallest per-role filter that does this, with a test and a decisions line.

**Commands (shared schemas + reducers, through the one command path):**

- Operators: `createDataSource` (label, kind, config, pollIntervalMs; the server makes the id; config validated by the adapter's schema with pt-BR errors), `updateDataSource`, `deleteDataSource`, `setDataSourceEnabled`, `pollDataSourceNow`, `startRecording` / `stopRecording`.
- The poller, as actor `sistema:fonte:<sourceId>`: `recordDataSourcePoll` (`sourceId`, and either `{ ok: true, shapes, receivedAtMs }` or `{ ok: false, error, attemptedAtMs }`). The authorize hook allows that actor this one command for its own source only. Tests cover a source acting for another source, an operator sending it, and the poller sending anything else.
- **Event-log volume.** A poll every two seconds would bury the operator's history. A routine successful poll whose source was already healthy changes slices but writes **no event-log row**. The rows written are:
  - every operator command;
  - a source going stale ("atrasada"), and recovering;
  - an invalid payload;
  - recording started and stopped.

  This is a deliberate exception to "every command is logged"; write it next to the code, in decisions, and in concept §4. A poll whose shapes equal the stored ones and whose status did not change is a no-op: nothing persisted or broadcast.

**Poller** (`modules/dataSources/poller.ts`): an injectable clock and timers, like auto-out and the macro runner.

- Polling: one loop per enabled source; never two polls of one source in flight; a timeout of `min(pollIntervalMs, 10 000)` per poll through the AbortSignal; a fixed interval with no backoff (simple first).
- Lifecycle: it starts and stops with enable/disable/delete. `pollDataSourceNow` runs one poll now, unless one is in flight.
- Every result goes through `recordDataSourcePoll`. The poller never writes state itself.
- Logging: a warn line per failure (`sourceId`, error), and info lines on stale and recovered.

**Recorder.**

- While `isRecording`, each accepted poll is appended as one JSON line `{ atMs, shapes }` to `${DATA_DIR}/recordings/<sourceId>/<startedAt ISO>.jsonl`.
- `stopRecording`, disabling or deleting the source closes the file.
- A slice `recordings` (metadata only: `id`, `sourceLabel`, `fileName`, `startedAtMs`, `endedAtMs`, `snapshotCount`) is rebuilt from the folder at boot and updated as files open and close.
- `DATA_DIR` already exists, or add it to `.env.example`.
- Disk-full or a write failure stops the recording with a logged error, a status line on the source, and the source keeps polling.

**Replayer** (adapter kind `replay`):

- Config: `recordingId`, `speed` (1, 2, 5, 10, 30, 60), `isLooping`, and optional `startOffsetMs`.
- On each poll it answers the recorded shapes whose recorded time is the latest at or before "replay start + elapsed × speed". It rewrites `updatedAtMs` and the session clock's `referenceWallClockMs` onto the current timeline, so a clock bound to a replay counts correctly.
- At the end it loops, or keeps answering the last snapshot.
- This is the rehearsal mode of concept §7 rule 8. A unit test with a fake clock covers it.

**Seed.** On first boot, and on a database with no sources, one source is seeded: "Simulador — Enduro" (kind `simulator`, default config), **disabled**.

### C. Simulator (server) — BAJAOVRLAY-41

Adapter kind `simulator`, in `modules/dataSources/adapters/simulator/`. Config:

- `seed` (integer) and `carCount` (10–100, default 60);
- `sessionDurationMs` (default 4 h), `lapLengthKm` (default 2.0, used only for plausibility), and `speed` (1–60, default 1, how fast simulated time runs);
- `simulatedStartAtMs` (when the simulated race started; set at enable time when missing);
- `isFailing` (default false). While true, every poll throws "falha simulada", so the stale path can be exercised on purpose from the page.

It produces `session`, `positions` and `standings` (overall).

Design, which is the heart of the readability review here:

- **A pure function of seed and simulated time.** `simulateEnduroAt(seed, carCount, elapsedSimulatedMs)` returns the whole race state with no memory between calls, so a restart, a replay or a test gets the same race at the same moment. The adapter only converts wall time to simulated time and builds the shapes from that state.
- **Randomness.** All of it comes from one small seeded generator in its own named file (`seededRandom.ts`, a standard algorithm such as mulberry32, with a comment saying which and why). Values are drawn per car, per lap index, so lap 34 of car 12 is always the same. No `Math.random` anywhere (lint rule or test).
- **The model, in plain steps with named constants** (each with a comment saying where the number came from):
  - Each car has a base lap time between 4:30 and 7:00, from the seed, with a better/worse spread across the field.
  - Per lap there is a ± variation of a few seconds.
  - A pit stop every 8–14 laps, lasting 1–4 minutes.
  - A few cars break down: a 5–15 minute stop or retirement, about 15 % of the field over 4 h.
  - Yellow periods at seeded moments, during which lap times are about 30 % slower.
  - Rarely, a short red with the clock stopped.
  - The checkered flag at `sessionDurationMs`; finished afterwards.
- **Derived values.**
  - Positions are ordered by laps completed, then by the time the last lap was completed.
  - Gaps: in ms when on the same lap as the leader, in laps otherwise.
  - Interval to the car ahead in ms.
  - `status` from pit, breakdown and retirement.
- **Session.** `state` follows the flags using the race-clock enum. The clock is in remaining mode from `sessionDurationMs`, running except during reds.
- **Standings.** Points for the other events come from a fixed seeded table. Enduro points are computed from the current positions with a simple, documented formula. Overall is the sum. Label it in the README as simulated, not the real Baja SAE scoring rules.
- **Teams.** `teams.fictional.json`: 100 plausible fictional team names ("Carcará Baja", "Pequi Off-Road"…) with school short names in the real style. The file header and README say they are fictional and never to be shown as real results.
- **Size.**
  - Keep the files small: the model in a few files, each named for one part (`lapTimes.ts`, `pitStops.ts`, `flags.ts`, `raceOrder.ts`, `shapesFromRaceState.ts`).
  - No file over 300 lines.
  - No clever generation, and no generic simulation engine: this is one scenario, written plainly. Other scenarios (acceleration runs, brackets) are a later item; leave a README note on where they would go.

### D. Control page: "Fontes de dados" (control)

A separate route, reachable from the header ("Fontes"). It must work on a tablet width (§3.4). All strings go in the pt-BR catalog.

- **List of sources.** Each row shows:
  - the label and the kind;
  - a status chip: "Ok" (green), "Atrasada" (amber, with the time since the last success), "Erro" (red, with the error in a tooltip), or "Desligada";
  - the last success time and the poll interval;
  - the actions: liga/desliga switch, "Atualizar agora", "Gravar" / "Parar gravação" (with a recording badge), Editar, Excluir (confirm).
- **"+ Fonte"**: create a source of kind Simulador or Reprodução.
  - These are per-kind forms written by hand; adapter kinds are few and not graphics, so the no-graphic-specific-code rule does not apply here.
  - The replay form picks from the `recordings` slice.
  - Validation messages come from the server's pt-BR errors.
- **Source detail.** For the selected source, the latest snapshot rendered readably:
  - a positions table (pos, carro, equipe, escola, voltas, última, melhor, diferença, status);
  - a standings table;
  - a session card (state with its flag colour, clock running live using the same clock helper the race clock uses, laps of the leader);
  - an "Exibir JSON" toggle for the raw payload, and a stale banner when stale ("Dados de hh:mm:ss — fonte atrasada").
- **Main console header.** A small health chip "Fontes: 2 ok · 1 atrasada" linking to the page. It is hidden when there are no enabled sources.
- **Store.** It handles the new slices like the others.

### E. Docs

- `docs/00-concept.md`:
  - §2: canonical shape, simulator, replay;
  - §4: dataSources and dataSnapshots slices, the commands, the `sistema:fonte:` actor, the event-log exception;
  - §7 rule 8: rehearsal = replay;
  - §8: the canonical shapes and the adapter interface as built.
- READMEs for `dataShapes/`, the module and each adapter folder.
- Decisions lines for every choice this brief leaves to you, and for each deliberate exception.

## Tests (write first, in this order of commits)

- **Shapes.**
  - Each sample validates.
  - Table-driven invalid rows, each saying why it exists: gap in both ms and laps; leader with a gap; unknown status; a state not in the race-clock enum; a negative lap time.
  - `listBindablePathsOfShape` returns the fixed, labelled list.
  - A test proves the session `state` enum equals the race-clock manifest's enum, read from the manifest file so they cannot drift.
- **Reducers / commands, table-driven.**
  - create/update/delete/enable with config validation per kind.
  - Poll ok stores the shapes and clears the error.
  - Poll failure keeps the shapes, marks stale and counts failures.
  - An invalid payload is a failure with a path error.
  - Recovery clears stale.
  - The no-op poll leaves no trace.
  - Event-log rows: only on the transitions listed in B (assert the count over ten routine polls).
  - Authorize rows: as listed in B.
  - Hydrate: snapshots survive a restart and come back stale.
- **Poller (fake clock).** Interval; no overlap when a poll is slow; timeout aborts and records failure; disable stops; poll-now; stale after `staleAfterMs` with no success.
- **Recorder.** Lines appended per accepted poll; file closed on stop/disable/delete; `recordings` slice rebuilt at boot from a temp folder; a write failure stops the recording and keeps polling.
- **Replayer (fake clock).**
  - Right snapshot at 1× and at 10×.
  - Loops, and holds at the end when not looping.
  - Rewrites `updatedAtMs` and the clock reference.
- **Simulator.**
  - Same seed and time give a deep-equal state, and a different seed gives a different race.
  - Output validates against the canonical shapes at t = 0, mid-race, during a yellow, after the checkered flag.
  - Positions are consistent: unique positions 1..n, ordered by laps then last-lap time, gaps agree with laps.
  - Over a simulated 4 h, the share of retired cars lies in a stated band, pit stops happen, and at least one yellow occurs.
  - `isFailing` throws.
  - No `Math.random` in the folder.
  - Name tests in race language ("the car that pitted on lap 12 loses the lead to car 7").
- **WS.** A renderer connection never receives `dataSnapshots`; an operator connection does.
- **Control.**
  - List rows and chips for ok, stale, error and disabled.
  - Create forms send the right commands; server errors are shown.
  - Recording toggle; poll-now.
  - The detail tables render a sample snapshot.
  - The stale banner.
  - The header chip's text and visibility.
- **E2E.**
  - Enable the seeded simulator at speed 60, and positions change between two reads.
  - Turn on `isFailing`: the chip reads "Atrasada" and the table still shows the last data.
  - Turn it off: it recovers.
  - Record ~20 s, create a replay source at 10×, and it shows recorded data.
  - Restart the server (if the e2e harness allows; otherwise an integration test): the snapshot is still there, marked stale.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-17.md` (documentation only).
2. Shapes: tests, then code.
3. Slices and commands: tests, then code.
4. Poller: tests, then code.
5. Recorder and replayer: tests, then code.
6. Simulator: tests, then code.
7. WS role filter: test, then code.
8. Control page: tests, then code.
9. E2E.
10. Docs and decisions.

Run the full root CI locally before opening the PR.

## Done when

Root CI green; lint with no warnings. On João's machine:

- the "Fontes" page shows the seeded simulator; enabled at speed 60 it shows a 60-car race moving every couple of seconds, with pit stops, retirements and a yellow at some point;
- "falha simulada" turns it "Atrasada" without losing the table;
- a recording can be replayed at 10×;
- a server restart keeps the last data;
- nothing on air changes.

The PR description has the walk steps for João, "Decisions taken", and anything left out and why. Report and stop; João merges after gate 2.
