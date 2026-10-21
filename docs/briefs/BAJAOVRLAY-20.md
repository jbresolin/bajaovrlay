# Agent brief — BAJAOVRLAY-20: bindings — item fields that read from data sources

**Branch:** `BAJAOVRLAY-20-bindings` off an up-to-date `main` (at or after PR #17). **One PR**, left open for João's review. Do not merge. Work through the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**Read first:**

- `CLAUDE.md`, all of it;
- `docs/00-concept.md` §2, §4 (FieldValue, the resolver, updateInstanceData, the update rules, fieldsChangedOnAir, overrides, the transforms line), §5 (binding resolution and live updates: this PR builds it), §7 rules 1, 3 and 4, and §8;
- `docs/decisions.md` from PR #13 on;
- `docs/testing-style.md`;
- the resolver (`resolveItemFieldsIntoGraphicData`), `putGraphicOnOutput`, `updateInstanceData` and `carryClockForward`;
- `packages/shared/src/dataShapes/` (the shapes and `bindablePaths.ts`);
- `packages/shared/src/transforms/`;
- `apps/server/src/modules/dataSources/` (how a snapshot change is recorded and broadcast);
- `slicesHiddenFromScreens` (screens get four slices only);
- `apps/control/src/features/schemaForm/`, `features/items/`, `features/playout/` (Edição rápida), `features/layers/`.

## Why

M2 is "graphics show real data". Sources, shapes, the simulator and the flex source exist, but no item can use them yet. This PR lets an item field say "read this from that source" instead of holding a typed value. The field either keeps updating while on air ("ao vivo") or freezes at the take ("congelado"). An operator can also correct a wrong value from a source without touching the source.

When this is done, a race-clock item bound to the simulator's session follows the simulated race on air: time, running, mode and flag. That is the first live data on screen, and the groundwork for the positions tower (BAJAOVRLAY-21).

Entity references (`kind: 'entity'`) are **not** in this PR; they come with the entity library (BAJAOVRLAY-19). Leave the FieldValue union ready for them.

## Deliverable

### A. The binding field value (shared)

`FieldValue` gains a third member, `binding`:

- `sourceId`, `shapeKey` and `path` (one of `listBindablePathsOfShape(shapeKey)`, see B);
- `isLive` (true: keeps updating on air; false: resolved once at the take);
- optional `transformId` and `transformParameters` (one transform, from the registry).
- Commands that carry fields (`createItem`, `updateItemFields`) accept it. An unknown source is refused with a pt-BR message naming the field, and so are an unknown path or an unknown transform.
- **The value type must fit the graphic's field:** a text path for a string field, a list path for an array field, an integer for an integer field. This is checked against the manifest schema when the item is saved, with a pt-BR refusal.
- Stored items holding `binding` load at boot. The resolver's M2 guard (`UNSUPPORTED_FIELD_KIND`) now covers only `entity`.

### B. Bindable paths, extended (shared)

`listBindablePathsOfShape` today lists places by index. Extend it, still hand-listed and labelled in pt-BR, with a test fixing the list:

- **A value type on every path:** `text`, `integer`, `number`, `boolean`, a `stateEnum` for the race-clock state, `positionsEntries` or `standingsEntries` for whole lists, and `clockGroup` (see D). The editor filters paths by the field's type with it.
- **Whole lists:** `positions.entries` and `standings.entries`, for the tower and the standings table.
- **A car by number** (asked for in PR #16): an entry chosen by `carNumber` instead of by place, for a team card or battle card that follows one car. Declare it as a path form with a parameter, `positions.entryOfCar.<field>` plus `carNumber` in the binding, rather than one path per car. Plain code, no general query language.
- **Standings labels:** "Nª linha", not "Nº colocado", as recorded in PR #16.

### C. Display transforms (shared)

Add the binding-side transforms concept §4 names to the registry, in their own files:

- `topN` (parameter `n`, 1–60): the first n entries of a list;
- `formatLapTimeAsText`: ms to "4:38,2" (tenths, truncated, the gap rule of PR #17);
- `formatGapAsText`: ms or laps to "+12,3 s" / "+2 voltas";
- `shortenSchoolName`: trims a school name to a stated maximum length, never guessing abbreviations.

Mark each transform as a mapping transform or a binding transform. The editor offers only binding transforms here, and the flex form keeps offering only mapping ones.

### D. Resolution (server) — pure, at take and live

`resolveItemFieldsIntoGraphicData` gains what it needs as plain inputs: the moment, the current snapshots by source id, and the overrides. It reads nothing itself.

**At take or preview:**

- A bound field reads its source's last good snapshot at the path, applies the overrides (E), then the transform.
- A missing source, no snapshot yet, or a path that is absent from the snapshot **refuses the take**. The pt-BR message names the field and the source ("Título: a fonte Simulador — Enduro ainda não tem dados"). There is never a half-rendered graphic (§5.1).
- An optional field whose bound value is absent is left out, like a cleared literal.
- **A stale source does not block a take** (§5.4). The instance is then shown with a stale badge (G).

**The clock group.** The race clock's four clock fields (roles `clockTime`, `wallClock`, `clockRunning`, `clockMode`) bound to `session.clock` must move together, or the clock jumps.

- So a binding on the path `session.clock` with value type `clockGroup` fills all four fields that carry those roles, from one binding stored on the `referenceTimeMs` field.
- The item editor offers it as one choice, "Relógio da fonte", when the graphic has the four roles.
- Write this next to the code. Name the roles, never a graphic, so the no-graphic-specific-code rule holds.

**Live updates (§5.2).** When a source's snapshot changes, every program and preview instance with a live binding on that source is re-resolved for its live fields only. When the result differs, it is written through the one command path:

- the command is `refreshBoundInstanceData` (`instanceId`, `data`), sent by the server actor `sistema:vinculos`;
- the authorize hook allows that actor this command only.

The rules for that command:

- It goes through the same steps as `updateInstanceData`: nulls, the update rule, the no-change check, the schema. `carryClockForward` passes a whole sent clock group through unchanged, as it does today.
- It never adds to `fieldsChangedOnAir`. Those lists are the operator's changes, and a source update is not one.
- **Event log:** a routine refresh writes no row, the same exception and reasoning as the routine poll (PR #16). A refresh refused by the schema writes one row, at most one per instance until a refresh succeeds again. Write it in decisions and concept §4.
- **Snapshot (`isLive: false`) fields are never refreshed.** A snapshot field in a preview is re-resolved at `takePreview`, the same exception as `takeTime` fields: frozen at the take, not at the preview.

**Where the live bindings live.** At take or preview, the server records each live binding of the new instance (field key plus binding) in a new slice, `instanceBindings`, keyed by instance id. Refreshes read that slice, never the item, so deleting or editing the item does not change what is on air (as with the rest of the instance).

- **Screens never receive it.** It is not one of their four slices, and graphics get resolved data only (rule 3).
- **Entries are removed** with the instance (clear, replace, promote).
- **On a restart** the slice is rebuilt from the persisted instances only if you store it; the plainer choice is to persist it with the instances. Record the choice.
- **When a source is deleted** while an instance is bound to it live: the refreshes stop, the data on air stays, and the control page shows "fonte excluída" on the row.

### E. Overrides (shared + server + control)

The `overrides` slice from concept §4, persisted. An override corrects what one source says, everywhere it is bound, until it is cleared. It is keyed in one of two ways:

- **A session field:** `sourceId`, `scope: 'session'`, `field` (for example `sessionName`).
- **A car's field:** `sourceId`, `scope: 'car'`, `carNumber`, `field` (`teamName`, `schoolName`, `status`…). It applies to every entry of that car in that source's positions and standings, whatever its place. A correction for "the third car" would follow the place rather than the car, so place-based overrides are not offered.

Each override also carries `value`, `reason` (required, pt-BR free text), `setBy` and `setAt`.

- **Commands:** `setOverride` and `clearOverride`, operators only. The value must fit the canonical field's type.
- **Applying them:** at take, in every live refresh, and when an override is set or cleared, since that changes on-air data at once through `refreshBoundInstanceData`.
- **Badges:** overridden values show a badge wherever they appear:
  - the Fontes detail tables (the cell, with the reason in a tooltip);
  - Camadas (the row: "valor corrigido");
  - Edição rápida (the field).
- **Where to set one:**
  - on the Fontes detail tables: right-click or a "⋯" on a cell gives "Corrigir valor…" and "Remover correção";
  - in Edição rápida, on a bound field: "Corrigir valor da fonte…".

### F. Item editor and Edição rápida (control)

**The item editor's per-field kind selector gains "Fonte"** for any field with at least one compatible path. Choosing it shows:

- the source (from the `dataSources` slice), then the path (filtered by the field's type, pt-BR labels), plus the car number when the path is a car-by-number one;
- "Ao vivo / Congelado na entrada", and the transform (binding transforms that fit the type), with its parameters;
- a live preview line of the value the field would get now, or why it can't be resolved.

**In Edição rápida, a loaded instance's bound fields are read-only.** Each one is labelled "Vinculado: Simulador — Enduro › Sessão › Bandeira (ao vivo)", and offers "Corrigir valor da fonte…" (E). Typing over a live field would be overwritten by the next refresh, and an override is the honest way to change it. Literal fields stay editable as today.

### G. Stale and source badges (control)

- **Camadas:** a row whose instance has live bindings on a source that is late or in error shows a chip, "fonte atrasada" or "fonte com erro" (the PR #16 health rule). When the source was deleted, the chip reads "fonte excluída".
- **Rundown rows and shortcut buttons of bound items** show a small "fonte" marker. When the item cannot be taken right now (no snapshot), they say so before the press, not only by the refusal.

### H. Docs

- `docs/00-concept.md`:
  - §2: binding, live/snapshot, override, clock group;
  - §4: FieldValue binding, the `instanceBindings` and `overrides` slices, `refreshBoundInstanceData`, the `sistema:vinculos` actor, the event-log exception, the display transforms;
  - §5: rewritten as built;
  - §7 rule 3: bound fields in the editor and Edição rápida.
- READMEs for anything new.
- Decisions lines for every choice this brief leaves open.

## Tests (write first, in this order of commits)

- **Shared.**
  - Binding schema rows: unknown kind; missing path; a transform with bad parameters.
  - The extended bindable-path list, fixed, with types. Every path exists in its shape schema.
  - Display transforms, table-driven:
    - tenths truncated: 278 299 ms reads "4:38,2";
    - laps against ms;
    - topN n out of range refused.
  - The mapping-vs-binding marking.
- **Resolver, table-driven, pure.**
  - A literal plus a binding.
  - A live and a snapshot binding at take.
  - A missing source, no snapshot, or a missing path refuses with the field named.
  - An optional field whose value is absent is left out.
  - Overrides:
    - a session field override;
    - a car override that follows the car to another place;
    - an override then a transform.
  - The clock group fills four fields from one binding.
  - A car-by-number path picks the right entry, and a car missing from the snapshot refuses.
  - topN on a list.
  - A stale source still resolves.
- **Live refresh, through the store with the simulator or a fixed fake source.**
  - A snapshot change refreshes a live field of a program instance and of a preview instance.
  - Snapshot fields untouched.
  - A no-change refresh leaves no trace.
  - No event-log rows over ten routine refreshes, and one row for a refused refresh.
  - `fieldsChangedOnAir` untouched by refreshes.
  - Authorize: `sistema:vinculos` may send only `refreshBoundInstanceData`, and operators cannot send it.
  - Deleting the item changes nothing on air.
  - Deleting the source stops refreshes and keeps the data.
  - `takePreview` re-resolves snapshot fields.
  - The race clock bound by the clock group follows a red flag (the clock stops) without a jump.
- **Overrides.**
  - Set and clear refresh on-air data at once.
  - The value type is checked.
  - The reason is required.
  - Persisted across a restart.
  - Operators only.
- **WS.** Screens never receive `instanceBindings` or `overrides`.
- **Control.**
  - The kind selector shows "Fonte" only when a compatible path exists.
  - The path list is filtered by type.
  - The live preview line.
  - The editor builds the right binding.
  - "Relógio da fonte" stores one clock-group binding.
  - Edição rápida shows bound fields read-only, with their label.
  - "Corrigir valor da fonte…" sends `setOverride`.
  - Badges on the Fontes cells and on Camadas.
  - The "fonte atrasada", "fonte com erro" and "fonte excluída" chips.
  - The "fonte" marker and the cannot-take-now hint.
- **E2E.**
  1. Enable the simulator, and create a race-clock item whose flag and clock are bound live to the session ("Relógio da fonte").
  2. Take it: the program shows the simulator's state.
  3. Restart the race at 60×, wait for the first yellow (seeded, predictable): the program's flag turns yellow by itself.
  4. Set an override on the session name: the title on air changes; clear it, and it changes back.
  5. Turn on "falha simulada": the Camadas row shows "fonte atrasada", and the clock stays on air.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-20.md` (documentation only).
2. Binding schema and the extended bindable paths: tests, then code.
3. Display transforms: tests, then code.
4. Resolver with snapshots and overrides (pure): tests, then code.
5. Take-time binding and `instanceBindings`: tests, then code.
6. Live refresh and `refreshBoundInstanceData`: tests, then code.
7. Overrides slice and commands: tests, then code.
8. Control (editor, Edição rápida, badges, chips): tests, then code.
9. E2E.
10. Docs and decisions.

Run the full root CI locally before opening the PR, and `git diff --check`.

## Done when

Root CI green; lint with no warnings. On João's machine:

- a race-clock item bound to the simulator's session goes on air and follows the race: the time runs, it turns yellow on the simulator's yellow, and it stops on a red;
- a correction to the session name changes the title on air and shows its badge;
- "falha simulada" shows "fonte atrasada" on the Camadas row and nothing blanks;
- refreshing OBS rebuilds the same picture.

The PR description has the walk steps for João, "Decisions taken", and anything left out and why. Report and stop; João merges after gate 2.
