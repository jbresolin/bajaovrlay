# Agent brief — BAJAOVRLAY-46: sponsor roll, sessions board, countdown and intermission

**Branch:** `BAJAOVRLAY-46-cadastros-boards` off an up-to-date `main` (after PR #26).

This runs **overnight and unattended**. Do not stop to ask. Where the brief leaves a choice
open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken",
and keep going. Choices marked **(decided)** are settled.

Follow CLAUDE.md's process:

* open a draft PR;
* run `pnpm verify` before every push, with `BAJAOVRLAY_E2E_PORT_OFFSET=400`;
* report, then stop;
* do not merge.

**Another agent works in parallel** on BAJAOVRLAY-47 (podium, battle card, QR card), on its own
branch, with port offset 500.

* Keep your changes to shared files small and additive: the kit's index and README,
  `docs/00-concept.md`, `docs/decisions.md`, and the schema form's kind selector.
* Whichever PR merges second merges `main` and resolves the conflicts.
* Never touch the other task's packages.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md`, `docs/ci.md`;
* `docs/00-concept.md`:
  + §4: FieldValue kinds, the entity reference, entities, `refreshBoundInstanceData`;
  + §9;
* `docs/design/directions/ardosia/`:
  + `catalogue.md`, entries 8 to 11;
  + `README.md`: the sizes table, and "Tokens added in pass 2";
  + `motion.md`: countdown, sessions board, intermission, "Every sponsor round", both sponsor
    rolls;
  + the pages `countdown`, `countdown-tela-cheia`, `sessions-board`, `intermission-board`,
    `sponsor-roll` and `sponsor-roll-canto`, with their `motion-*` demos (the visual spec).
* The kit and the graphics built on it in PRs #25 and #26: `standings`, `lower-strip`,
  `message-ticker` and `sponsor-bug`. Follow their structure and take every gate-2 lesson from
  those PRs:
  + timers are stopped on stop, dispose and disconnect, **with tests that fail when the stop is
    removed**;
  + an update during the stop-out only stores the data;
  + a shared helper goes into the kit and is never copied;
  + tokens only;
  + `gddType: single-line` on short texts;
  + files stay under 400 lines, and you split before you reach it;
  + e2e checks are web-first and never depend on which page is showing;
  + the generated fields' fieldset;
  + manifests may not reuse the editor's field titles.
* The entities module, `entityAttributes.ts`, the entity reference's resolution and live
  refresh, and `findStatusOfScheduleSlot`.

## Why

Breaks, the waiting screen and sponsor time are the rest of an event day. These four
graphics read our own Cadastros (sponsors, the schedule) rather than a scoring feed.

## Deliverable

### A. Sponsor levels as the design names them (shared, server, control)

**(decided)** The sponsor tier becomes the design's level: `diamante`, `ouro`, `prata`,
`bronze`, `apoio` or `realizacao`, in that round order.

* **Migrating stored rows:** a stored `master` is read as `diamante` when the stored rows load
  at boot. A stored row that fails its schema stops the boot, so this migration must run
  before validation. Test it with an old row.
* **CSV:** the column accepts `master` as an alias of `diamante` and exports `diamante`.
* **Cadastros:** shows the pt-BR level names.
* **Headings** come from the pt-BR catalog: "PATROCÍNIO DIAMANTE", "PATROCÍNIO OURO",
  "PATROCÍNIO PRATA", "PATROCÍNIO BRONZE", "APOIO", "REALIZAÇÃO".
* **Holds:**
  + each level uses its `--motion-sponsor-hold-<level>` token;
  + bronze has none and uses `--motion-sponsor-hold`;
  + write the order and the holds in one place (the kit), used by every sponsor round.

### B. A whole list from Cadastros in an item field (shared, server, control)

The sponsor rolls need every sponsor, and the sessions board needs every schedule slot.
**(decided)** Add a FieldValue kind `entityList`: `{ kind: 'entityList', entityType: 'sponsor' | 'scheduleSlot' }`.

* **What it resolves to:**

  + **sponsors:** `name`, `level`, `logoUrl` (when it has one), `logoOnLightPlate`,
    `rollWeight`, in round order, then by `rollWeight` from high to low, then by name;
  + **schedule slots:** `slotId`, `sessionName`, `sessionKind`, `startsAtMs`, `endsAtMs`,
    `place`, sorted by start.

  Write the attribute lists by hand, as `entityAttributes.ts` does.
* **Status is not in the list.** A slot's status changes with the clock, and nothing refreshes
  the air when only time passes (concept §4). The graphic works it out itself (see C).
* **Live:** an edit, add or delete of any record of that type refreshes the instances that hold
  the list, through `refreshBoundInstanceData`, as entity references do now.
* **When the list can't be used:**

  + a sponsor without a logo is left out of the list, and a test proves it;
  + an empty list refuses a required field at the take with a pt-BR reason, and leaves an
    optional one out.
* **Item editor:** the kind selector gets "Lista dos cadastros", with the entity type and a
  "Valor agora" line ("17 patrocinadores", "9 sessões"). It is offered only to an array field
  whose `items.required` keys the list carries, using the same rule as `listItemKeys.ts`.

### C. Four graphic packages on the kit

1. **`countdown`**, in two layouts chosen by a field.

   * **`card`:** layer `clock`. The race clock's card without the band.
   * **`fullscreen`:** layer `fullscreen`. The narrow waiting board.

   Fields:

   * the session name;
   * the start, as `startsAtMs`, an absolute moment.

   **(decided)** The graphic counts down to `startsAtMs` itself, on the server-aligned clock
   from the kit. That replaces the catalogue's idea of feeding the race clock's clock group in
   `remaining` mode: nothing has to be recomputed at the take, and a refresh of the start
   simply moves the target.

   * **At zero** it shows "0:00" and stops. It never counts negative.
   * **Typical item:** both fields from a schedule slot in Cadastros, through an entity
     reference (`sessionName`, `startsAtMs`). Or typed, with the existing date-and-time
     control.
   * **The count's text** follows the design: `h:mm:ss` above an hour, `m:ss` below. Put the
     formatting in the kit if another graphic already has one.
2. **`sessions-board`** (layer `fullscreen`).

   * **Fields:**
     + the title, default "PROGRAMAÇÃO DO DIA";
     + the event line;
     + the date line;
     + the slots: an `entityList` of schedule slots.
   * **Status:** each slot's status is worked out on air from the server-aligned clock with
     **the same rule as `findStatusOfScheduleSlot`, never a copy**. If importing it from
     shared would bundle zod into the graphic, move the pure function into a zod-free module
     both sides import.
   * **Status changes on air:** the board re-checks on a timer aligned to the next slot
     boundary, not every frame, and crossfades the changed rows as `motion.md` says. Test it
     with fake time.
   * **Size:** up to 12 slots. More than 12 shows the 12 around the slot in progress, and you
     record the rule.
3. **`sponsor-roll`**, in two layouts chosen by a field.

   * **`fullscreen`:** layer `fullscreen`. Pages of up to six tiles, one level a page, a level
     shared evenly between its pages, each page held by its level, "Realização" last.
   * **`corner`:** layer `bug`. The bug's card, with the sponsor cell crossfading on each
     sponsor's level hold.

   Fields:

   * the sponsors: an `entityList`;
   * the event word, for the corner.

   **The round order and the holds come from A.** The paging rules ("nine Ouro on pages of
   four are 3 + 3 + 3") get a table-driven model test with the real 17 sponsors, which give
   five pages.
4. **`intermission-board`** (layer `fullscreen`).

   * **Fields:**
     + the event and date lines;
     + the next session's name and `startsAtMs` (as in the countdown);
     + the top five: standings entries, bound with `topN` 5 and optional;
     + the sponsors: an optional `entityList`.
   * **Reuse, never copy:** the count comes from the countdown's kit parts, and the sponsor line
     from the sponsor roll's paging rules, moved into the kit.
   * **Optional parts:** without the top five, the next-session card takes the whole width with
     its words centred. Without sponsors, there is no sponsor line.

### D. Docs

* `docs/00-concept.md`:
  + §4: sponsor levels and the `entityList` kind;
  + §9: what is built.
* READMEs, each with an item recipe field by field.
* A decisions line for every choice.

## Tests (write first)

* **Shared and server:**

  + the level enum, and the `master` migration of a stored row at boot;
  + the CSV alias;
  + the `entityList` schema;
  + resolution and order for both types;
  + a sponsor without a logo is left out;
  + an empty list, for a required field and for an optional one;
  + a live refresh after a sponsor edit and after a slot delete;
  + the editor's offer rule.
* **Control:**

  + the "Lista dos cadastros" kind and its "Valor agora" line;
  + the level names in Cadastros.
* **Each graphic:** model, view, manifest–data agreement, animation timing from tokens, and
  timer stops that fail when removed. In particular:

  + **countdown:** the text either side of an hour; reaching zero and stopping; a refreshed
    target; the server offset;
  + **sessions board:** the status at given moments, using the shared rule's own test table;
    a crossfade at a boundary under fake time; the 12-slot window;
  + **sponsor roll:** the paging table, with the real 17 sponsors giving 5 pages; the hold per
    level; the corner crossfade order; a list that shrinks while on air;
  + **intermission:** all four combinations of the top five and the sponsors.
* **Screenshots:** grey and black, in their own commit, side by side with the design pages.
* **E2E**, on the real server:

  1. Import sponsors and schedule slots.
  2. Create a sponsor-roll item from "Lista dos cadastros" and take it. The head reads
     "PATROCÍNIO DIAMANTE".
  3. Create a countdown card from a schedule slot and take it. It shows the session and a
     count.
  4. Create a sessions board and take it. It shows the slots.

  Make the assertions web-first, with no fixed waits. Page turns and status changes are proven
  in component tests with fake time.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-46.md`.
2. Sponsor levels and the migration.
3. `entityList`: shared, server, editor.
4. The kit parts: round order and holds, count text, the status rule's home.
5. `countdown`.
6. `sessions-board`.
7. `sponsor-roll`.
8. `intermission-board`.
9. Screenshots.
10. E2E.
11. Docs and decisions.

## Done when

* `pnpm verify` is green and reported.
* The PR description has:
  + the walk;
  + the design-page-to-baseline list;
  + "Decisions taken";
  + what was left out and why.

Report and stop. João marks the PR ready after gate 2.
