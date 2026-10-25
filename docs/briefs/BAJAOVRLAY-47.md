# Agent brief — BAJAOVRLAY-47: podium, battle card and QR card

**Branch:** `BAJAOVRLAY-47-podium-battle-qr` off an up-to-date `main` (after PR #26).

This runs **overnight and unattended**. Do not stop to ask. Where the brief leaves a choice
open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken",
and keep going. Choices marked **(decided)** are settled.

Follow CLAUDE.md's process:

* open a draft PR;
* run `pnpm verify` before every push, with `BAJAOVRLAY_E2E_PORT_OFFSET=500`;
* report, then stop;
* do not merge.

**Another agent works in parallel** on BAJAOVRLAY-46 (sponsor roll, sessions board, countdown,
intermission), on its own branch, with port offset 400.

* Keep your changes to shared files small and additive: the kit's index and README,
  `docs/00-concept.md`, `docs/decisions.md`, and the transform registry's index.
* Whichever PR merges second merges `main` and resolves the conflicts.
* Never touch the other task's packages.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md`, `docs/ci.md`;
* `docs/00-concept.md`:
  + §4: bindings, the transform registry (rule 5), the entity library, live refresh;
  + §9;
* `docs/design/directions/ardosia/`:
  + `catalogue.md`, entries 2, 5 and 12;
  + the sizes table in `README.md`;
  + `motion.md`: podium, battle card, QR card;
  + the pages `podium-passo-1..3`, `battle-card`, `sheet-battle`, `qr-card` and their
    `motion-*` demos (the visual spec).
* The kit and the graphics built on it in PRs #25 and #26: `team-card`, which has the logo plate
  rule, and `standings`. Follow their structure and take every gate-2 lesson from those PRs:
  + timers are stopped on stop, dispose and disconnect, **with tests that fail when the stop is
    removed**;
  + an update during the stop-out only stores the data;
  + a shared helper goes into the kit and is never copied;
  + tokens only;
  + `gddType: single-line`;
  + files stay under 400 lines;
  + e2e checks are web-first;
  + manifests may not reuse the editor's field titles.
* `packages/shared/src/transforms/` (registry, `topNTransform.ts`), and the entity library.

## Why

Podium, battle card and QR card are the last transient graphics of the catalogue. The podium
needs each car's team logo, which no feed sends. It is the first list that joins Cadastros, so
it adds the list join that PR #23's README left for later.

## Deliverable

### A. The `withTeamLogos` binding transform (shared and server)

**(decided)** A named binding transform `withTeamLogos`. It takes a list of entries that carry
`carNumber`, positions or standings. It hands back the same list with each entry's team
`logoUrl` (`/media/<id>`) and `logoOnLightPlate` added from Cadastros.

* A car with no team or no logo gets neither field.
* Nothing else changes.

It needs the entity library, so binding transforms gain a read-only context:
`apply(value, parameters, context)` with `context.teams`.

* Transforms stay pure: the output depends only on the inputs.
* The existing transforms ignore the context, and their tests change only where the signature
  forces it.
* The resolver passes the library at take, at preview and in live refreshes.
* A team edit refreshes the instances whose bindings use `withTeamLogos`, through the existing
  entity-change refresh.

### B. Three graphic packages on the kit

1. **`podium`** (layer `fullscreen`, three steps).
   * **Fields:**
     + the head title, default "PÓDIO";
     + the event line;
     + the entries: positions or standings, bound as a snapshot with `topN` 3 then
       `withTeamLogos`.
   * **Steps:** Próximo reveals the 3rd, then the 2nd, then the 1st. A card not yet revealed
     keeps its room, invisible, so the cards already shown never move.
   * **Logo:** the logo box and plate follow `team-card`. Without a logo, the card has no logo
     row, and the content stays centred in its height.
   * **Tie:** standings with a tie for a podium place show the places as given, with the shared
     rank on both. Record the rule.
   * Use the OGraf step model the existing graphics use (`stepCount`, `goToStep` or the kit's
     `playSteps`).
2. **`battle-card`** (layer `lower-third`).
   * **Fields:**
     + the two cars: the car ahead and the car behind, each with position, car number, team,
       school and laps;
     + the gap: the car behind's `intervalMs`;
     + an optional trend set by hand: `closing`, `opening` or `steady`, with an optional change
       in ms.
   * **Typical item:** cars chosen by number through `positions.entryOfCar.<n>` bindings, live.
   * **(decided)** Trend, when not set by hand:
     + the graphic keeps the gap it saw at the car behind's last lap change;
     + on each update where the car behind's `laps` grew, it compares the new gap with that
       stored one;
     + closing by at least 0.1 s shows "▸◂ FECHANDO −0,7" in green;
     + opening by at least 0.1 s shows "◂▸ ABRINDO +0,7" in `--cue-down-text`;
     + otherwise it shows "— ESTÁVEL";
     + until it has two readings, it shows "— ESTÁVEL" with no number.
   * **Trade-off:** this memory lives in the graphic, so a renderer reload starts it again.
     Write that next to the code and in decisions. A trend set by hand always wins.
   * **Motion:** Atualizar changes the gap number in place. The trend cell crossfades only when
     its word changes (`motion.md`).
   * **pt-BR numbers:** a comma decimal and the typographic minus, as the standings did.
3. **`qr-card`** (layer `lower-third`).
   * **Fields:** the call to action, and the address.
   * The graphic makes the code from the address when it loads, with nothing from the network.
   * **(decided)** Use the zero-dependency MIT encoder `qrcode-generator`, pinned. It is bundled
     into the graphic and nowhere else. If you measure a smaller zero-dependency encoder that
     passes the same tests, you may use it; record the sizes.
   * Error-correction level M. The code's cell size comes from the 176 px box (tokens).
   * An address too long for that box at level M is refused by the item editor through the
     manifest's `maxLength`, derived from the encoder's capacity and tested.
   * Nothing moves while the card is up.
   * **Test that it scans:** decode the rendered code in a test with a pure-JS decoder as a
     **devDependency** (e.g. `jsqr`) on the preview's canvas or SVG. It must round-trip the
     address.

### C. Docs

* `docs/00-concept.md`: §4 (transform context, `withTeamLogos`) and §9 (what is built).
* READMEs, each with an item recipe field by field.
* A decisions line for every choice.

## Tests (write first)

* **Shared and server:**

  + `withTeamLogos` on positions and on standings, table-driven: with a logo; a team with no
    logo; a car with no team; the plate flag;
  + the existing transforms are unchanged under the new signature;
  + the resolver passes the library at take, preview and refresh;
  + a team edit refreshes a podium instance's logos.
* **Each graphic:** model, view, manifest–data agreement, animation timing from tokens, and
  timer stops (where there are timers) that fail when removed. In particular:

  + **podium:** the reveal order; hidden cards keep their room (assert the boxes don't move
    between steps); with and without logos; a tie;
  + **battle card:** the trend table:
    - first reading;
    - closing, opening and steady at the 0.1 s threshold;
    - no lap change means no new comparison;
    - a manual trend wins;
    - the pt-BR signs;
    - the crossfade only when the word changes;
  + **QR card:** the decoded code equals the address for short and maximum-length addresses;
    the editor refuses one over `maxLength`.
* **Screenshots:** grey and black, in their own commit:

  + the podium at steps 1 to 3;
  + the battle card closing, opening and steady;
  + the QR card.
* **E2E**, on the real server:

  1. Import the simulator's teams, upload a logo for car 7 and start the simulator.
  2. Create a podium item bound to positions with `topN` 3 and `withTeamLogos`, and take it.
  3. Press Próximo three times. All three cards are shown, and the car with a logo shows it.
  4. Create a battle card for two cars and take it. It shows both cars and a gap.
  5. Create a QR card and take it. Its image decodes to the address.

  Make the assertions web-first, with no fixed waits.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-47.md`.
2. The transform context and `withTeamLogos`.
3. `podium`.
4. `battle-card`.
5. `qr-card`.
6. Screenshots.
7. E2E.
8. Docs and decisions.

## Done when

* `pnpm verify` is green and reported.
* The PR description has:
  + the walk;
  + the design-page-to-baseline list;
  + "Decisions taken";
  + what was left out and why.

Report and stop. João marks the PR ready after gate 2.
