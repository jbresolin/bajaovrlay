# Agent brief — BAJAOVRLAY-23: sponsor bug, lower strip and message ticker

**Branch:** `BAJAOVRLAY-23-bug-strip-ticker` off an up-to-date `main` (after PR #25).
Follow CLAUDE.md's process: a draft PR, `pnpm verify` before every push, a report, then stop.
Do not merge.

Where this brief leaves a choice open, take the plainer option, write it in
`docs/decisions.md` and under "Decisions taken", and move on. Choices marked **(decided)** are
settled; do not reopen them.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md` and `docs/ci.md`;
* `docs/00-concept.md` §4 (layers, items, FieldValue kinds, entities) and §9;
* `docs/design/directions/ardosia/`:

  + `README.md` ("The lower strip", sizes and boxes);
  + `catalogue.md` ("The layer plan", "What can share the screen", entry 13);
  + `motion.md` (lower strip, sponsor bug, page turns, `--motion-strip-*`);
  + the pages `sponsor-bug`, `lower-strip`, `message-ticker`, `combo-strip`, `combo-ticker`
    and their `motion-*` demos.

  **The pages are the visual spec.**
* `packages/graphics/kit/` and the three graphics built on it in PR #25 (`lower-third`,
  `team-card`, `standings`), the model to follow;
* `packages/graphics/race-clock/` (`clockTicker.ts`, `raceClockModel.ts`, the clock group and
  its server-clock handling);
* `apps/control/src/features/schemaForm/` (how a manifest becomes a form, and the
  unsupported-shape fallback);
* the entities module (sponsors) and the team's `logoOnLightPlate` (PR #25), the model for
  the sponsor's plate.

## Why

These are the always-on graphics: the bug sits top-left all day, and the bar along the
bottom carries either the running order (the strip) or the announcements (the ticker). Both
bars carry a clock block that must show the same time as the race-clock card.

## Deliverable

### A. The clock block moves into the kit (first, no behaviour change)

The strip and the ticker show the race clock's time and flag pill. That makes three users of
the race clock's clock group: the running time between readings, the server-clock alignment
and the flag.

**What moves:** the parts both bars need (`clockTicker` and the time and flag model) go into
`packages/graphics/kit`. The race clock is migrated, and its tests change only in imports.

**Rule:** the race clock's card markup and styles stay in race-clock. Only the time logic
moves, plus the flag pill's model if both bars draw it.

### B. Sponsor logo plate (shared + server + control)

The design gives sponsor logos the team card's plate rule. **(decided)** A sponsor gets
`logoOnLightPlate`, exactly as the team did in PR #25:

* optional, left out meaning no;
* the Cadastros checkbox with the side-by-side preview (reuse the team's component);
* a `placa_clara` CSV column;
* an entity attribute;
* old stored rows still boot.

Tiers are **not** touched in this task. Renaming them to the design's levels (Diamante …
Realização) belongs with the sponsor roll (BAJAOVRLAY-26).

### C. Three graphic packages on the kit

Each follows PR #25's structure:

* a manifest with `v_baja.defaultLayerId` and category;
* model, view and animations in their own files;
* a pt-BR preview with Entrar/Sair and `?stage=grey|black`;
* motion from tokens, exactly as `motion.md` describes;
* tokens only for colour, size and duration.

1. **`sponsor-bug`** (layer `bug`): the Baja SAE Brasil mark, the event word ("ENDURO") and
   the sponsor cell (a caption over one sponsor's logo).
   * **Fields:**
     + the event word: typed, optional;
     + the caption: typed, default "Apresentado por";
     + the sponsor's logo URL (`imageUrl`) and its plate flag.
   * **Typical item:** the logo and the plate from a sponsor in Cadastros.
   * **Without a sponsor logo,** the card is the mark and the event word alone, never an
     empty cell.
   * It never pulses or cycles. Cycling through sponsors is the corner roll, which comes in
     26.
2. **`lower-strip`** (layer `ticker`): the clock block, then the cars of the running order,
   six per page, then the page cell ("1/6").
   * Each car pill shows the position with its ordinal sign ("1º"), the car chip and the
     school's short name.
   * **Fields:**
     + the positions entries, bound live (as the tower's are);
     + the clock group, bound like the race clock's;
     + whether the clock block is shown (default yes).
   * **Paging:** every `--motion-strip-hold` the page turns, with the cascade in
     `motion.md`. It uses the kit's `pageTurner`.
   * **(decided)** Six cars a page is a constant, with the README's measurement as the
     comment. Names are never cut; the design measured that six always fit.
   * Write a test that renders the real 34-car field and asserts no page is wider than the
     bar.
   * **Live updates** redraw the current page in place. A car that moves to another page is
     simply on that page at the next turn.
3. **`message-ticker`** (layer `ticker`): the clock block (optional, as on the strip), an
   "AVISO" label pill, then one message per page, and the page cell.
   * **Fields:**

     + the label: typed, default "AVISO";
     + the messages: a list of short texts, at least one;
     + whether the clock block is shown.
   * Messages page on `--motion-strip-hold` and never scroll.
   * A message too long for the bar wraps nowhere. Instead, the item editor refuses it with a
     pt-BR reason that gives the limit, and a view test proves the limit is right for the
     bar's width at the design's size.

     **(decided)** The limit is a character count derived from the measurement, kept in the
     package and named in the manifest's `maxLength`. No runtime text measuring.

### D. A list of texts in the item form (control)

The ticker's messages are the first typed list. Today the generated form shows an array of
strings as the read-only unsupported box. Make an array whose items are strings editable:

* one text input per message, with "Adicionar mensagem" and a remove button per row;
* reordering with dnd-kit, as the rundown does;
* each row checked against `items.maxLength`, and the list against `minItems`, in pt-BR.

The list goes on air through "Atualizar no ar" like any field. This is how an operator adds a
message during the event.

Keep it to arrays of strings. Arrays of objects stay as they are (bound lists, or the
unsupported box).

### E. Docs

* `docs/00-concept.md`: §4 (the sponsor's plate, typed lists of texts) and §9 (built).
* READMEs for the new packages, each with an item recipe, field by field.
* A `docs/decisions.md` line for every choice.

## Tests (write first)

* **Kit:**
  + the moved clock logic, with its tests moved too;
  + race-clock still green, imports only.
* **Shared, server and control (the sponsor plate):** the schema, a CSV round-trip, an old
  row still booting, an entity attribute, the Cadastros checkbox.
* **Control (the list of texts):**
  + add, remove and reorder;
  + `maxLength` and `minItems` messages in pt-BR;
  + "Atualizar no ar" sends the new list.
  + An array of objects is still the unsupported box.
* **Each graphic:**
  + model tests:
    - the bug with and without a sponsor logo, with and without the event word;
    - strip paging: 34 cars give 6 pages with the right page cells, and every page fits the bar;
    - the ticker with one and with three messages;
    - the clock block on and off for both bars;
  + view tests in pt-BR;
  + manifest–data agreement;
  + animation timing from tokens;
  + a page timer stopped on stop, dispose and disconnect (as PR #25 did).
  + **Same time on both:** the strip's clock block and the race clock fed the same reading
    show the same text at the same moment.
* **Screenshots** (1920×1080, grey and black, in their own commit):
  + the bug with and without a sponsor;
  + the strip page 1, with and without the clock block;
  + the ticker with and without the clock block;
  + `combo-strip` and `combo-ticker` composed on one renderer page if the e2e harness
    allows it. If not, say so and leave them out.
* **E2E** (apps/control, real server):
  1. Import the simulator teams and start the simulator.
  2. Create a strip item bound live to positions and to the session clock, and take it. Page 1
     shows six cars and the clock.
  3. Create a sponsor with a logo, and a bug item from it. Take it.
  4. Create a ticker item with two messages and take it. Add a third message with
     "Atualizar no ar", and the page cell reads "1/3".
  5. No fixed waits (docs/ci.md). The page turns are proven by component tests with fake
     time.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-23.md`.
2. The clock logic into the kit, with race-clock migrated.
3. The sponsor plate.
4. The list of texts in the item form.
5. `sponsor-bug`.
6. `lower-strip`.
7. `message-ticker`.
8. Screenshot baselines.
9. E2E.
10. Docs and decisions.

## Done when

* `pnpm verify` passes, and is reported with each round.
* On João's machine:
  + the three previews play as `motion.md` says;
  + the E2E walk works by hand;
  + the strip and the race clock show the same time;
  + the screenshots match the design pages side by side.
* The PR description has:
  + the walk steps;
  + the design-page-to-baseline list;
  + "Decisions taken";
  + anything left out and why.

Report and stop. João marks the PR ready after gate 2.
