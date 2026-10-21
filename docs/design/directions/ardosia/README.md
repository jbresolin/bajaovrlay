# ardosia — the scoreboard, kept

The faithful sibling of the scoreboard the stream uses today (placarbaja.juansalles.com.br):
the same slate, the same rows as separate pills, the same colour per column (yellow position,
blue car chip, green laps), the same logo-and-title head, in a clean open-licence face instead
of Urzeit and with everything the brief adds: a real race clock with the flag, status icons,
a detailed tower, a strip, a lower third and a bug that all belong to the same family.

**Chosen by João at the gate on PR #19**, with his adjustments applied here: one face for
everything (Bebas Neue, in caps), the flag band optional on the clock, the ordinal sign on the
strip's positions ("1º"), no word on the checkered flag, "quebrado" with a wrench instead of
"parado" with a triangle, the car chips' digits centred, a doubled margin under the clock's
time, taller head pills, and the compact tower's head naming its columns (POS, Nº, EQUIPE,
VOLTAS) like the detailed one. The two other directions (grafite, marinho) were removed;
`../README.md` keeps the comparison as the record.

## A ideia

The scoreboard's look, grown into a system. Every graphic is a slate pill or card
(`rgb(20 25 48 / 0.84)`, 8 px corners, 3 px gaps between pills), the car number is always a
brand-blue chip, positions are yellow text, laps are green text, and the type is Bebas Neue
in caps, as the scoreboard's rows are. The column sits top-right as today; the bug takes the
top-left corner.

What changed from the scoreboard, and why: Urzeit is "Personal Use" and distressed, so Bebas
Neue (SIL OFL, caps, tabular figures) sets every word and number; the slate went from 78% to
84% so text passes AA over bright sky; the panel moved inside the title-safe area (the
scoreboard's 30 px margin puts it outside); rows cascade in 30 ms apart instead of 300 ms;
and yellow is used as text only. Brand yellow
(`#F4C42A`) in the position column is the one place any direction uses yellow: it is never a
field, and the flag slot always carries its word, so a column of yellow digits cannot be read
as a yellow flag. If João prefers no yellow at all, grafite is this direction without it.

Pages: `race-clock`, `race-clock-sem-bandeira` (the clock without its flag band),
`positions-compact`, `positions-detailed`, `lower-strip`, `lower-third`, `sponsor-bug`, the
combos `combo-tower` (clock + compact tower + bug) and `combo-strip` (strip + lower third),
the sheets `sheet-flags`, `sheet-status` and `sheet-columns` (the detailed tower with every
column, the default set, and the optional columns off), and `motion-demo` (`motion.md`). Every `.html`
here is generated: `generatePages.mjs` writes them from `../../sample-data.json` through the
page assembly in `../../tools/slatePages.mjs` (markup in `slateTemplates.mjs`, sheets in
`slateSheets.mjs`) and formats them with the repo's Prettier:
`node docs/design/directions/ardosia/generatePages.mjs` from the repo root. `styles.css`
imports the structure sheet (`../../tools/slate-base.css`) and adds this direction's few
rules; `tokens.css` is where the direction lives.

The flag band is optional: a session with no flag state (acceleration, the suspension test)
takes the clock without it, 152 px tall instead of 192 (`race-clock--no-flag`), and the tower
under it may start 40 px higher, which fits a 21st row. The checkered band and the strip's
checkered pill show the pattern alone: the word "QUADRICULADA" stays only as the band's
accessible name. The strip's positions carry the ordinal sign ("1º", "13º"); the towers,
where the position column is read as a column, do not.

**Pass 2 (BAJAOVRLAY-43)** extended the direction to the rest of the §9 catalogue, as the spec
for the build briefs: `catalogue.md` holds the layer plan, what can share the screen and each
graphic's data needs; the table under "The catalogue" below lists the pages. The new pages
come from the same generator through `../../tools/slateCataloguePages.mjs` (markup in
`slateNotices.mjs`, `slateCards.mjs`, `slateBoards.mjs`, `slateSteps.mjs`, sheets in
`slateCatalogueSheets.mjs`; structure in `slate-cards.css` and `slate-boards.css`, which
`styles.css` imports after the base sheet), and the data they show was added to
`sample-data.json` by `buildSampleData.mjs` (the full standings, a per-event table ranked from
them, the brackets sample, and the typed fixtures of `sampleFixtures.mjs`: cities, notices, a
schedule, messages, fictional sponsors).

## Legibility at 720p on a phone

Sizes at 1080p, with the 720p equivalent in brackets: clock time 56 px (37); lower-third name
44 px (29); strip time 44 px (29); strip positions, chips and school names 30 px (20);
tower rows 28 px (19) for positions, car chips, names and laps; session name 34 px (23);
flag word 26 px (17); detailed tower's gaps and lap times 26 px (17); captions, school
names in the detailed tower, the lower third's role and team line and the sponsor line
22 px (15), the floor (Bebas caps at 22 px are as tall as a text face's 20 px). Bebas Neue's
caps have a tall shape that reads at 19 px on a 720p phone where a mixed-case face at the
same size would not; the trade is that everything is caps, as on the scoreboard today. Pills
are 34 px (23 at 720p) with 3 px gaps, so rows separate without lines.

The catalogue keeps the same scale: the overall standings' rows are 40 px with 30 px text
(the strip's size) and 26 px event points; the per-event table, the bracket's pills and the
notices use the tower's 28 px; the battle card the strip's 30 px with a 44 px gap; the
sessions board 44 px times and 34 px names; the podium 72 px positions and 44 px names; the
countdown 56 px on the card, 160 px on the waiting screen and 96 px on the intermission
board; the QR card 34 px and 26 px on its light surface. Nothing on air is under 22 px
(`checkLayout.mjs` reports the smallest text of every page).

## Safe areas

Everything on air is inside the 90% title-safe box (x 96..1824, y 54..1026), checked by
`node docs/design/tools/checkLayout.mjs ardosia`:

| Graphic                          | Box (1080p)                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Race clock                       | x 1404..1824, y 54..246 (420 × 192: 64 head, 88 body, 40 flag band)                         |
| Compact tower                    | x 1404..1824, y 254..1026 (head pill 32, then 20 pills of 34 with 3 px gaps)                |
| Detailed tower                   | x 752..1824, y 254..1026 (1072 wide with the default columns, head pill 32, 20 pills of 34) |
| Lower strip                      | x 96..1824, y 954..1026 (72 tall)                                                           |
| Lower third                      | x 96.., bottom at y 940 (name pill 64, role pill 40), above the strip's room                |
| Sponsor bug                      | x 96..428, y 54..178                                                                        |
| Race clock without the flag band | x 1404..1824, y 54..206 (420 × 152)                                                         |
| Team card                        | x 96..870, y 756..940 with photo and logo (774 × 184); x 96..450, y 810..940 without        |
| Battle card                      | x 404..1516, y 863..940 (centred, 72 px pills)                                              |
| Fastest lap                      | x 96..516, y 186..290 (the notice slot: 420 wide, 8 px under the bug)                       |
| Penalty notice                   | x 96..516, y 186..350 (one line of reason and penalty; taller when the reason wraps)        |
| Countdown card                   | x 1404..1824, y 54..206 (the clock without its band)                                        |
| QR card                          | x 96..649, y 740..940                                                                       |
| Message ticker                   | x 96..1824, y 954..1026 (the strip's bar)                                                   |
| Sponsor roll, corner             | x 96..428, y 54..178 (the bug's card)                                                       |
| Standings, overall               | x 96..1824, y 54..1018 (head 64, column head 32, 20 pills of 40)                            |
| Standings, per event             | x 96..1824, y 54..898 (three columns of 20 pills of 34)                                     |
| Bracket                          | x 96..1824, y 54..1026 (head 64, then a 900 px stage)                                       |
| Podium                           | x 96..1824, y 54..1026 (the cards on the stage's baseline)                                  |
| Sessions board                   | x 320..1600, y 204..876 (narrow board, nine slots of 64)                                    |
| Intermission board               | x 320..1600, y 314..766                                                                     |
| Countdown, full screen           | x 320..1600, y 330..750                                                                     |
| Sponsor roll, full screen        | x 320..1600, y 260..820 (six tiles of 240)                                                  |

## Contrast

Computed with `node docs/design/tools/contrastRatio.mjs`; translucent slate composited over
`#E8EEF5` (bright sky, the worst backdrop):

| Text             | On                         | Ratio   | Where                                                                                             |
| ---------------- | -------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `#E8ECF4` text   | slate at 84% over sky      | 9.34:1  | names, times, captions' neighbours                                                                |
| `#AAB4C8` muted  | slate at 84% over sky      | 5.31:1  | captions, school names, page cell                                                                 |
| `#F4C42A` yellow | slate at 84% over sky      | 6.73:1  | position numbers, podium positions                                                                |
| `#4ADE80` green  | slate at 84% over sky      | 6.35:1  | laps, clock laps, points totals, the closing trend                                                |
| `#7CB3F5` blue   | slate at 84% over sky      | 5.07:1  | the opening trend on the battle card                                                              |
| `#FFFFFF`        | `#386DB4` car chip         | 5.23:1  | car numbers                                                                                       |
| `#FFFFFF`        | `#009739` leader chip      | 3.83:1  | the leader's position, the winner's chip, the "MELHOR VOLTA" badge: 26 px and up, large text only |
| `#FFFFFF`        | `#003B71` navy cell        | 11.27:1 | the penalty ("+30 SEGUNDOS")                                                                      |
| `#111111`        | white at 96% over sky      | 18.77:1 | the QR card                                                                                       |
| `#E8ECF4` text   | head slate at 94% over sky | 12.64:1 | clock head, tower head, board heads                                                               |
| `#AAB4C8` muted  | head slate at 94% over sky | 7.18:1  | round names, column heads, the ticker's label                                                     |
| text at 55%      | slate at 84% over sky      | 3.59:1  | retired rows and a bracket's losers, 28 px: large text only, by design dimmed                     |
| `#FFFFFF`        | flag pre `#5B6472`         | 5.98:1  | PRÉ-LARGADA                                                                                       |
| `#FFFFFF`        | flag green `#15803D`       | 5.02:1  | VERDE                                                                                             |
| `#111111`        | flag yellow `#FFD600`      | 13.37:1 | AMARELA                                                                                           |
| `#FFFFFF`        | flag red `#DC2626`         | 4.83:1  | VERMELHA                                                                                          |
| `#F5F5F5`        | `#111111` word plate       | 17.32:1 | QUADRICULADA over the squares                                                                     |
| `#FFFFFF`        | flag finished `#1F2937`    | 14.68:1 | ENCERRADA                                                                                         |

## Tower rows

- **Compact: 20 rows** (positions 1–20), the brief's minimum met exactly. The clock card ends at
  y 246; the tower starts 8 px under it at 254, its head pill is 32 px and each row pill 34 px
  with 3 px gaps, so 20 rows end exactly at 1026, the title-safe edge. A 21st pill would end at 1063. Narrower gaps or
  32 px pills would give 21 rows at the cost of the scoreboard's airy pills, which is the look
  being kept (open question 1).
- **Detailed: 20 rows** (positions 1–20) of 34 px, the compact tower's pill. Five columns
  are always there, POS 36, cue 12, chip 44, EQUIPE 300 (name + school at 22 px) and VOLTAS 84;
  the rest are optional, each with its width token in `tokens.css`, and the tower's grid and
  width follow the columns shown (the generator writes both on the element, so a column
  turned off takes its width with it): DIF. 112, INTERV. 108, ÚLT. VOLTA 128, MELHOR 104,
  PARADAS 96 (every pit entry, the shape's `pitStops`), ABAST. 84 (refuels; the canonical
  shape has no such field yet, so the column is off by default and shows "—" when on), and
  the status column 28. With the default set (times, PARADAS, status) the tower is 1072 px
  wide; an event without lap timing shows VOLTAS and PARADAS only, 668 px (`sheet-columns`).
  A value the source does not know shows "—", never 0 or a blank. Gaps and intervals in
  seconds are written without the unit ("+19,0", "+1 VOLTA"): the face has no lowercase, so
  "+19,0 s" would read "+19,0 S"; the column caption (DIF., INTERV.) says what the number is,
  as on every timing board.
- The field has 60 cars: the towers page through it (positions 1–20, 21–40, 41–60) on the
  same hold as the strip, the head pill staying and the rows changing (`motion.md`, "More than
  20 cars"); page 1 is what the mock-up pages show, and `motion-demo.html` turns the pages.

## The lower strip

Pages, not scrolling: scrolled text smears under stream compression and cannot be read on a
phone while it moves; a page that stays still for 7 s can. Each car is a pill (position in
yellow with its ordinal sign, "1º", car chip, school name as the short name, 30 px caps), as
wide as its name; the pills share the bar. The generator sets **6 cars per page** (10 pages, 70 s for the field), the most
for which every page of the 60-car field fits with whole names (measured in Chromium: the
widest page needs 1244 px of the 1392 available; 7 per page would need 1444). The clock
block (time 44 px and the flag pill) never moves; the page cell at the right reads "1/10".

## The catalogue (pass 2)

Everything is a slate pill or card with a blue chip where a car is named, as in pass 1; the
full-screen graphics are "boards" (a head card like the clock's, then pills like the towers'),
the small transient ones are "notices" (one card in a slot under the bug). `catalogue.md`
has the layer plan, the coexistence rules and the data needs; `motion.md` the in, out and
steps.

| Graphic              | Pages                                | Layer             | What it is                                                                                             |
| -------------------- | ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------ |
| Team card            | `team-card`, `team-card-sem-foto`    | lower-third       | The big chip, the team at 44 px, school and city; photo and logo cells only when they exist            |
| Battle card          | `battle-card`, `sheet-battle`        | lower-third       | Two 72 px pills bottom-centre with the gap at 44 px and the trend (word, signed change, shape)         |
| Standings, overall   | `standings`                          | fullscreen        | 20 rows of 40 px a page, one muted column per event, the total in green; three pages for 60 teams      |
| Standings, per event | `standings-por-prova`                | fullscreen        | The whole field at once, three columns of 20 tower pills; ties share a rank                            |
| Bracket              | `bracket-passo-1`, `-2`, `-3`        | fullscreen        | One column per round; "Next" reveals a round; the winner's chip green, the loser dimmed                |
| Podium               | `podium-passo-1`, `-2`, `-3`         | fullscreen        | 2nd, 1st (taller), 3rd on one baseline; "Next" reveals 3rd, 2nd, 1st                                   |
| Fastest lap          | `fastest-lap`, `combo-fastest-lap`   | notice (new)      | A 420 px card under the bug: green "MELHOR VOLTA" badge, the lap, the car, the time at 44 px           |
| Penalty or incident  | `penalty-notice`, `sheet-notices`    | notice (new)      | The same card with a warning shape, the car, the reason and the penalty in a navy cell; no flag colour |
| Countdown            | `countdown`, `countdown-tela-cheia`  | clock; fullscreen | The clock's card without the band; a narrow board with the count at 160 px                             |
| Sessions board       | `sessions-board`                     | fullscreen        | A narrow board, one pill per slot with the state as a shape and a word                                 |
| Intermission board   | `intermission-board`                 | fullscreen        | What is next with its count, the top five, a sponsor line                                              |
| Sponsor roll         | `sponsor-roll`, `sponsor-roll-canto` | fullscreen; bug   | Six tiles a page; the bug's card with a sponsor cell                                                   |
| QR card              | `qr-card`                            | lower-third       | The one light surface: the code, the call to action, the address                                       |
| Message ticker       | `message-ticker`, `combo-ticker`     | ticker            | The strip's bar with an "AVISO" label and one message per page                                         |

## Type

One face: Bebas Neue 400 (its only weight; caps and numbers, tabular figures) for every
number, name, caption and title, as João asked at the gate. It has no lowercase glyphs, so
`styles.css` sets the whole page in caps (a lowercase letter would fall back to another
face), and no weight above 400 is ever asked for (it would be synthesised). It is SIL OFL
and self-hosted (`../../fonts`). Urzeit, the scoreboard's face, is licensed to SAE but not
available and cannot be bundled; once it is, it could set the session word in the clock head
("ENDURO DE RESISTÊNCIA") and the bug's "ENDURO", the two places the scoreboard uses it
today, and nothing else.

## Tokens added in pass 2

All in `tokens.css` under "The catalogue", in the naming of the ones above. Colours:
`--cue-down-text` (#7CB3F5, the "down" blue as text, since the chip blue is a field colour
and fails as text on slate), `--panel-light` and `--text-on-light` (the QR card),
`--bracket-line`. Geometry: `--notice-top`, `--notice-width`, `--notice-head-height`,
`--notice-row-height` (the notice slot); `--chip-large-size`, `--size-chip-large` (the team
card's and the podium's chip); `--team-photo-width`, `--team-photo-height`,
`--team-logo-size`; `--battle-height`, `--battle-gap-width`; `--qr-size`; `--board-width`
(the narrow boards), `--board-stage-height`, `--board-row-height`, `--size-board`,
`--col-points`, `--col-total` (standings); `--session-row-height`, `--session-time-width`;
`--size-countdown`, `--size-countdown-small`; `--size-podium-position`, `--podium-width`,
`--podium-height`, `--podium-height-winner`; `--bracket-row-height`; `--sponsor-mark-small`,
`--sponsor-mark-large`, `--sponsor-tile-height`. Motion: `--motion-notice-hold`,
`--motion-board-hold`, `--motion-sponsor-hold` (`motion.md`).

## Open questions for João

1. 20 rows with the scoreboard's airy pills, or 21–22 rows with 32 px pills and 2 px gaps?
2. The strip holds 6 cars per page with whole school names; two-line cells (position and chip
   over the school) would hold 10–11. Keep the one-line pills?
3. The column is top-right as on the scoreboard; broadcast convention is left. One token.
4. The detailed tower is 1060 px wide; dropping MELHOR brings it to about 950.
5. Gaps in the detailed tower are written without the unit ("+19,0") because the face has no
   lowercase "s". Fine, or should the product's shared gap format change too?
6. When the flag band is off, should the tower move up 40 px to gain a 21st row, or keep its
   place so the layout never shifts between sessions?
7. ABAST. (refuels) needs a field the canonical positions shape does not have; PARADAS is the
   shape's `pitStops` (every pit entry). Add a `refuels` field to the shape (BAJAOVRLAY-18/21),
   or is PARADAS enough on air?

Pass 2 (BAJAOVRLAY-43), the judgment calls to confirm:

8. A new layer, **notice** (z 45, "Aviso"), for the fastest lap and the penalty notice, in a
   slot under the bug (x 96..516 from y 186), so they share the screen with everything else.
   The alternative, the bug layer, would take the bug off air for every notice.
9. The **battle card** sits bottom-centre on the lower-third layer (it replaces a lower third)
   rather than under the clock in the tower's slot, so the tower can stay up during a fight.
10. The **penalty** is written in words ("+30 SEGUNDOS", because the face has no "s") in a
    brand-navy cell, and "BANDEIRA PRETA" as words only; the notice carries no flag colour and
    no coloured band at all, so it never reads as the clock's flag band.
11. **Standings**: 20 rows a page (three pages, the tower's page size) rather than the 23 that
    would fit; the per-event table shows all 60 at once in three columns and does not page.
12. The **QR card** shows the stream's scoreboard address of today
    (placarbaja.juansalles.com.br), in caps like everything else, on the one light surface.
13. **Wide boards** (standings, bracket, podium) are taken with the column, the notice and the
    ticker cleared, by a macro; the **narrow boards** are 1280 px centred so the bug and the
    clock card stay beside them.
14. The **fastest lap's "VOLTA 34"** is the car's lap count, since `bestLapMs` carries no lap
    number: add a `bestLapNumber` to the positions shape, or let the operator type it?
15. The **team card** shows the shape's short school name ("MAUÁ"); the full name would come
    with the entity library. Fine for now?
16. **Screenshots**: every page over every background as the contract says, 241 files; the
    folder is listed in the PR. If that is too much for the repo, the intermediate steps and
    the variants could be shot over frame 1, grey and black only.
