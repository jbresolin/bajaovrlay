# Agent brief — BAJAOVRLAY-44: the event inbox — discrete events, auto-show rules, operator approval

**Branch:** `BAJAOVRLAY-44-event-inbox` off an up-to-date `main` (after PR #20 is merged). One PR, left open for João's review. Do not merge. Work through the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**This runs in parallel with BAJAOVRLAY-19 (entity library)** on another branch. Both add a `FieldValue` kind and touch the resolver and the item editor's kind selector. To keep the merge small:

* put the new kind's schema, resolution and editor parts in their own files, adding one line to each shared switch or union;
* whichever PR merges second merges `main` and resolves.

**Read first:**

* `CLAUDE.md`;
* `docs/00-concept.md` §2, §4 (commands, actors, auto-out, macros, the event-log exceptions), §5, §7;
* `docs/decisions.md` from PR #16 on;
* `docs/testing-style.md`;
* the data sources module (how snapshots arrive, `recordDataSourcePoll`);
* the bindings module (resolver, refresh, the `sistema:vinculos` actor);
* `core/store/autoOut.ts` and the macro runner (server-side actors with injectable clocks);
* the simulator;
* `packages/shared/src/dataShapes/`;
* on PR #21's branch, `docs/design/directions/ardosia/` (`catalogue.md`, and the fastest-lap and penalty notice pages with their layer plan: the new `notice` layer at z 45).

## Why

Everything so far shows **state**: the clock and tower follow what the race is now. Some things are **events**: something happened once, should appear once, and someone must decide when. A penalty given, a new fastest lap, a change of leader, and later a viewer's Super Chat (BAJAOVRLAY-35).

João's rules:

* fastest lap and leader change go on air **automatically** by default;
* penalties wait for the **operator**;
* Super Chats always wait for **approval**.

Penalties are entered in the scoring system, and will come through its API (BAJAOVRLAY-18). Until then they come from the simulator, or are typed by the operator.

## Deliverable

### A. Data the events need (shared)

* **New canonical shape `incidents`:** `sessionId`, `updatedAtMs`, and `entries[]`. Each entry has:

  + `incidentId` (stable, from the source), `carNumber`, `teamName`, `schoolName`;
  + `kind` (enum: `penalty`, `warning`, `incident`);
  + `reason` (pt-BR text: "Queima de largada");
  + optional `penaltyText` ("+30 s", "Volta cancelada", "Bandeira preta"), optional `lap`, `atMs`.

  Add a sample, the bindable paths and the flex mappable fields. Validation as for the other shapes.
* **`bestLapNumber`** (optional integer ≥ 1) on positions entries, for the fastest-lap notice (asked by PR #21's design). It is bindable and mappable.
* **The simulator** produces `incidents`: a few seeded penalties and warnings over a 4 h race, plausible reasons, deterministic like the rest. It also fills `bestLapNumber`.
* **Comment on BAJAOVRLAY-18** (in the PR description, for João to copy): the Baja app's endpoints should expose incidents with a stable id, and each car's best lap number.

### B. Detecting events (server)

Detectors are pure functions in their own files. Each compares a source's previous accepted snapshot with the new one and returns events:

* `newIncident`: an `incidentId` not seen before;
* `newFastestLap`: the session's best lap improved (car, lap time, lap number);
* `leaderChanged`: position 1's `carNumber` differs;
* leave a README note for future ones: flag changed, session finished.

**Every event has:**

* a deterministic `eventId` (for example `<sourceId>:incident:<incidentId>`, `<sourceId>:fastestLap:<carNumber>:<lap>`), so an event is never shown twice, even after a restart;
* `kind`, `sourceId`, `detectedAtMs`, and a `payload` with the fields the graphic needs (car, team, school, reason, penalty text, lap time, lap number).

**Baseline:** the first snapshot a source delivers after boot, or after it is enabled, establishes what has already happened. It fires **nothing**, so a restart mid-race doesn't replay the day's penalties. Seen ids are persisted. Write this next to the code.

**Detection runs where accepted polls are recorded,** after the new snapshot is accepted. It emits events through the one command path as the actor `sistema:eventos`.

**Manual events:** the operator can create an event by hand ("+ Evento": kind penalty or notice, car number, reason, penalty text). Car, team and school are filled from the entity library when BAJAOVRLAY-19 is merged, or from the latest positions snapshot, or typed.

### C. The inbox and the rules (shared + server)

* **Slice `events`, persisted.** Each event is the record from B plus `status`: `pending`, `queued`, `onAir`, `shown`, `dismissed` or `expired`, with the moment of each change.

  + Keep the last 200 events in the slice; the table keeps everything.
  + Screens never receive it.
* **Slice `eventRules`, persisted.** One rule per kind:

  + `mode`: `ask`, `auto` or `ignore`;
  + `itemId`: the prepared item that shows this kind;
  + `durationMs`: how long it stays on air;
  + `maxAgeMs`: an event not shown within this is marked `expired`.

  **Seeded defaults** (João's call):

  + `fastestLap` auto, 8 s;
  + `leaderChanged` auto, 6 s;
  + `newIncident` ask, 10 s;
  + `manual` ask;
  + a `superChat` rule seeded as ask-only. The schema refuses `auto` for it: viewer content is never shown without approval.

  `maxAgeMs` defaults to 2 min for automatic kinds and none for ask.
* **Commands.** Operators may send all of these:

  + `showEvent(eventId)`, `dismissEvent(eventId)`, `createManualEvent`, `updateEventRule`;
  + `takeEventOffAir`, if the plain layer clear isn't enough. Prefer reusing `clearLayer`, and record which.

  The actor `sistema:eventos` may send only `recordDetectedEvents` and `showEvent`. Authorize tests for both.
* **Showing an event** takes the rule's item, filling the item's event fields (D) from the payload, with `autoOutAfterMs = durationMs`. The instance records its `eventId`, so the event becomes `shown` when the instance leaves the air.
* **The automatic runner** (`modules/events/eventRunner.ts`, injectable clock, like auto-out and the macro runner) shows `auto` events through `showEvent`, with queue rules:

  + it never replaces something on the layer that isn't an event graphic. It waits, with the event `queued`, until the layer is empty;
  + events of one layer show one after another, in detection order, with a gap of `--motion-out` plus 1 s between them;
  + an event older than `maxAgeMs` while queued becomes `expired`, never shown late.

  Write the rules next to the code and in decisions.
* **Event log:**

  + each detected event writes a row (events are rare, so no exception);
  + each show, dismiss or expiry writes a row;
  + polls with no new events write none, as today.

### D. Items filled by an event (shared + server + control)

`FieldValue` gains `eventField` (`path` into the event payload: `carNumber`, `teamName`, `reason`, `penaltyText`, `lapTimeText`, …). An item with event fields is a template:

* **Takes:** it can only be taken through an event (`showEvent`), never by Space or a shortcut button. A direct take is refused with a pt-BR message ("Este item é preenchido por um evento").
* **Preview:** Prévia on such an item fills it from a **sample payload** of the rule's kind, so the operator can see the look.
* **The item editor's kind selector gains "Evento"** for fields with a compatible payload path, with the paths filtered by type, as for bindings.

### E. The notice graphic (packages/graphics)

Build the notice from PR #21's design (fastest-lap and penalty variants), so events have something to show:

* a new OGraf package `notice`, on a new `notice` layer at z 45, seeded as the tower layer was;
* fields: `variant` (`fastestLap` or `penalty`), `carNumber`, `teamName`, `schoolName`, `reason`, `penaltyText`, `lapTimeText`, `lapNumber`, all optional except `variant` and `carNumber`;
* tokens only, through the theme package; in and out per PR #21's `motion.md`.

PR #21 is still being revised. Read its design from the branch. If it changes before this PR merges, restyle in a follow-up rather than waiting. Record it.

Seed two items for the rules, in a quick-fire panel named "Eventos": "Volta mais rápida" and "Penalização", both on the notice graphic with event fields. Wire them into the default rules.

### F. Control page (control)

* **An "Eventos" tab** in the "Atalhos e macros" strip, with a count badge of pending events. It lists pending and queued events, newest first. Each event has:
  + its kind, car chip, team and reason, and how long ago;
  + **Prévia** (the rule's item filled from this event, on the preview output), **No ar** (`showEvent`) and **Descartar**.
  + Below the list are the last 20 shown, dismissed or expired events, greyed out, each with its status.
* **A new pending event** makes the badge pulse. It plays an optional short sound, a per-browser setting with "Som de eventos" on by default, stored in localStorage as the one allowed convenience.
* **"+ Evento"** opens the manual-event form.
* **"Regras"** opens the rules editor: per kind, the mode, the item picker, the duration and the max age. `superChat` shows ask only, with an explanation.
* **Camadas** marks an instance that came from an event ("evento: penalização · carro 42").

### G. Docs

* `docs/00-concept.md`:
  + §2: event, inbox, rule;
  + §4: the `incidents` shape, `bestLapNumber`, the `events` and `eventRules` slices, the commands, `sistema:eventos`, `eventField`, the `notice` layer;
  + §5: detection;
  + §7: a new rule, "events are shown once, by rule or by the operator".
* READMEs for the events module, detectors and the notice package.
* Decisions lines for every choice this brief leaves open.

## Tests (write first, in this order of commits)

* **Shapes.** `incidents` validates; sample; bindable and mappable lists; `bestLapNumber`.
* **Simulator.** Incidents are deterministic for a seed, at least one penalty in 4 h, and `bestLapNumber` is consistent with the best lap.
* **Detectors, table-driven, pure.**
  + A new incident fires once.
  + The same incident again fires nothing.
  + A best lap improves: fastest-lap event with the right lap number.
  + A slower lap fires nothing.
  + A leader change fires once.
  + The baseline snapshot fires nothing.
  + Deterministic event ids.
* **Inbox and rules through the store.**
  + Detected events are recorded with event-log rows.
  + A restart keeps the seen ids: no replay.
  + Show, dismiss and expire transitions.
  + `superChat` auto refused by the schema.
  + Authorize rows for `sistema:eventos`.
  + A manual event.
* **Runner (fake clock).**
  + An auto event shows with `durationMs` auto-out.
  + Two events queue and show one after the other with the gap.
  + A non-event graphic on the layer makes them wait.
  + A queued event past `maxAgeMs` expires.
  + Ask events never show by themselves.
* **Event fields.**
  + Resolution from a payload.
  + A direct take is refused.
  + Prévia uses the sample payload.
  + The editor's "Evento" kind.
* **Notice graphic.** Screenshots of both variants against the design; in and out; missing optional fields; tokens only (the existing guard).
* **Control.**
  + The Eventos tab: list, badge, Prévia, No ar, Descartar.
  + Sound setting.
  + Manual form.
  + Rules editor (superChat locked to ask).
  + Camadas marking.
* **E2E.**
  1. Enable the simulator at speed 60 with a seed whose first penalty comes early (pick it and document it).
  2. The penalty appears in Eventos as pending, and nothing goes on air.
  3. Press No ar: the notice shows, then leaves after 10 s (use a short duration in the test).
  4. A fastest lap goes on air by itself.
  5. Restart the server: no event is replayed.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-44.md` (documentation only).
2. `incidents`, `bestLapNumber` and the simulator: tests, then code.
3. Detectors: tests, then code.
4. Events and rules slices, commands, persistence: tests, then code.
5. The runner: tests, then code.
6. The `eventField` FieldValue and template items: tests, then code.
7. The notice graphic, layer and seeded items: tests, then code.
8. Control: Eventos tab, manual form, rules editor, Camadas: tests, then code.
9. E2E.
10. Docs and decisions.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, every `pnpm test:e2e` and `git diff --check` before opening the PR. Report the CI job's duration. CI time is tracked in BAJAOVRLAY-42, so add no real-time waits.

## Done when

Root CI green; lint with no warnings. On João's machine, with the simulator at 60×:

* a penalty arrives in Eventos with a badge and a sound, and goes on air only when he presses No ar;
* fastest laps appear by themselves for 8 s and never overlap;
* a restart replays nothing;
* he can type a penalty by hand and show it.

The PR description has the walk steps, "Decisions taken", the BAJAOVRLAY-18 endpoint note, and anything left out and why. Report and stop; João merges after gate 2.
