# Agent brief — BAJAOVRLAY-25: the elimination bracket

**Branch:** `BAJAOVRLAY-25-bracket` off an up-to-date `main`.

Follow CLAUDE.md's process:

* open a draft PR;
* run `pnpm verify` before every push, with `BAJAOVRLAY_E2E_PORT_OFFSET=600`;
* report, then stop;
* do not merge.

Where this brief leaves a choice open, take the plainer option, record it in
`docs/decisions.md` and under "Decisions taken", and move on. Choices marked **(decided)** are
settled.

**Another agent runs in parallel** on BAJAOVRLAY-45 (item editor speed), in
`apps/control/src/features/items` and `apps/control/src/features/schemaForm`.

* Stay out of those folders; this task shouldn't need them. Camadas (`features/layers`) is
  fine.
* Whichever PR merges second merges `main` and resolves the conflicts.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md` and `docs/ci.md`;
* `docs/00-concept.md`:

  + §4: data shapes, bindings, `nextOnLayer` and steps (PR #27);
  + §6: stepping;
  + §9;
* `docs/design/directions/ardosia/`:

  + `catalogue.md`, entry 4;
  + `README.md`: the sizes for the bracket tree and round board;
  + `motion.md`: Bracket;
  + the pages `bracket-passo-1..7`, `sheet-bracket-results` and `motion-bracket`.

  These pages are the visual spec.
* `docs/design/sample_data/results/super_prime.md`, the real Super Prime: 33 cars in 64 slots;
* `packages/shared/src/dataShapes/bracketsShape.ts` (the draft) and the other shapes;
* the simulator (`apps/server/src/modules/dataSources/adapters/simulator/`);
* the flex mapping (`packages/shared/src/flexMapping/`);
* `packages/shared/src/steps/graphicSteps.ts` and the `podium` package, the first stepped
  graphic and the model to follow;
* the kit;
* every gate-2 lesson of PRs #25–#28:

  + timer stops have tests that fail without them;
  + an update during the stop-out only stores the data;
  + nothing is copied that belongs in the kit;
  + tokens only;
  + files stay under 400 lines;
  + no test waits on a real animation, and you finish motion with
    `runningMotions.testSupport`;
  + prove the suite pinned to 2 cores with `GITHUB_ACTIONS=true CI=1`.

## Why

The Super Prime and the other eliminations are shown as a bracket. This is the last graphic
of the catalogue, and with it M3 closes.

Progression, meaning who advances, is the source's job: the Baja app's `tournament` table,
through the flex source later (BAJAOVRLAY-18). BajaOvrLay only shows it. For rehearsal, the
simulator gets a bracket of its own.

## Deliverable

### A. The brackets shape, final (shared)

**(decided)** Refine the draft as the catalogue proposes.

**Per match:**

* `bestOf`: optional, an odd whole number ≥ 1. With it, each car may carry `wins`.
* `walkover`: optional boolean; the winner advanced without racing.
* **A bye:** `carB` is left out. The winner must then be `carA`, with `walkover` true.
* **Result kind:** a match's result is one of three, decided by what it carries. Times
  (`timeMs` on the cars), wins (`bestOf` with `wins`), or only the winner. Refuse mixing times
  and wins in one match, with a pt-BR reason.

**Per round:**

* `isThirdPlace`: optional. At most one such round, and it comes after the semifinals'
  round.

**Rules, as `superRefine` checks with pt-BR reasons:**

* the existing ones (two different cars, a winner that is one of them);
* a bye's winner is `carA`;
* `wins` never exceeds `(bestOf + 1) / 2`;
* a decided best-of has a winner with exactly that many wins.

**Also update:**

* bindable paths: the whole list of rounds, as today;
* flex mappable fields for brackets, so BAJAOVRLAY-18 can map the Baja app;
* the samples.

The real Super Prime gets a sample file and a table-driven test.

### B. A bracket in the simulator (server)

The seeded simulator also answers a brackets snapshot, a deterministic Super Prime of its
fictional teams.

* **The draw:** seeded, padded to the next power of two with byes.
* **Results:** matches are decided over simulated time at the simulator's speed: the early
  rounds plain, the semifinals, final and third place best of 3.
* **Restart:** "Reiniciar corrida" restarts the bracket too.
* **Pinned in tests:** the seed's draw and timings, as with the flag schedule. A seed the e2e
  relies on gets a row in the seeds table.

### C. Steps whose count depends on the data (shared, server, renderer)

The podium has a fixed `stepCount`. A bracket's steps depend on its rounds:

* one step per round-board page;
* one per tree round;
* one for third place.

`graphicSteps.ts` reads only the manifest today. Check what the vendored OGraf schema allows
for a dynamic step count (for example `stepCount: -1`), then pick the plainer of these two:

1. **A pure step-count function.** `countBracketSteps(rounds)` lives in a zod-free module
   that the graphic and the server both import. The server uses it, through a named registry
   keyed by the manifest's `v_baja`, when the manifest's count is dynamic.
2. **The renderer reports the count.** The renderer reports the step count the graphic
   reached on load. The server stores it on the instance.

Record the choice and why. Whichever you pick, these must hold:

* Camadas shows "Passo n de N" correctly, and "Próximo" switches off at the end;
* a renderer reload replays to the same step (rule 1);
* a live update that changes the number of rounds keeps the current step valid. Clamp it,
  and test it.

### D. The `bracket` graphic package (layer `fullscreen`)

**Picking the form:** the graphic picks between the two forms from the rounds alone.

* **Round boards:** for any round with more than four matches. Two columns, 40 px match cards,
  32 matches a page ("1ª rodada · página 1/2").
* **The tree:** from the quarter-finals down. A column per round under its name pill, each
  match centred between the two it comes from, with connecting lines. Every round name shows
  from the tree's first step, and one round of pills is revealed per step.
* **Third place:** at the foot of the final's column, with its own step just before the
  final's.

**Result cells:**

* time, wins or a winner's mark;
* "—" while undecided;
* a winner's chip turns green, and the loser dims like a retired row.

**W.O. and byes:**

* **W.O.:** an outlined "W.O." tag in the winner's cell, and "—" for the other car.
* **A bye's empty slot:** a dashed "SEM ADVERSÁRIO" outline with no chip.

**Live:**

* a result arriving while its match is on screen crossfades the result cell and turns the
  winner green (`--motion-flag`);
* nothing on screen moves;
* an update during the stop-out only stores the data.

**Motion:** exactly as `motion.md` describes. Board cards cascade by the row stagger; a board's
cards lift out on Próximo; tree rounds are added, and their lines fade in once a round's last
pill is in.

**Reuse:**

* the wide board head (`wideBoardHead`, shared with standings and podium);
* the kit's logo plate, if logos show (they don't in the design);
* pt-BR numbers.

**Size:** split before 400 lines. The board, the tree layout (match positions and lines) and
the step plan each go in their own module, and the tree layout gets pure tests.

### E. Docs

* `docs/00-concept.md`:
  + §4: the brackets shape, the dynamic steps;
  + §9: the bracket built, which closes the catalogue.
* The package README, with an item recipe.
* A decisions line for every choice.

## Tests (write first)

**Shape:**

* table-driven:
  + each result kind;
  + a mix of times and wins refused;
  + a bye;
  + a W.O. by absence;
  + wins over the limit;
  + a decided best-of without enough wins;
  + two third-place rounds;
  + a third place before the semifinals;
* the real Super Prime sample passes.

**Simulator:**

* the seeded draw;
* byes up to a power of two;
* results at given simulated moments;
* best of 3 from the semifinals on;
* the restart.

**Steps:**

* `countBracketSteps`, or the reported count, for:
  + 8 cars (3 steps);
  + 64 cars (3 boards and the tree);
  + 128 cars (4 boards, the first in two pages, then the tree);
  + the real Super Prime;
  + with and without third place;
* Camadas's "Passo n de N";
* the clamp after a shrinking update;
* a reload at a step.

**Graphic:**

* model, view and the tree layout (pure positions, lines between centres);
* manifest–data agreement;
* motion timing from tokens;
* timer and motion stops on stop, dispose and disconnect, each failing without it;
* a live result crossfade;
* an update during the stop-out.

**Screenshots** (grey and black, in their own commit), side by side with the design pages:

* each of `bracket-passo-1..7`;
* `sheet-bracket-results`.

**E2E** (real server):

1. Start the simulator.
2. Create a bracket item bound live to its brackets, and take it.
3. Press Próximo through every step. Camadas counts correctly, and Próximo switches off at the
   end.

Use web-first assertions, with no fixed waits.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-25.md`.
2. The shape, samples and flex fields.
3. The simulator bracket.
4. Dynamic steps.
5. The bracket graphic: model and tree layout, then view and motion.
6. Screenshots.
7. E2E.
8. Docs and decisions.

## Done when

* `pnpm verify` is green and reported.
* The full Vitest suite passes 5 times pinned to 2 cores with `GITHUB_ACTIONS=true CI=1`.
* The PR description has:
  + the walk;
  + the design-page-to-baseline list;
  + "Decisions taken";
  + what was left out and why.

Report and stop. João marks the PR ready after gate 2.
