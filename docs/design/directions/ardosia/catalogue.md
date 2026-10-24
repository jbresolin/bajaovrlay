# ardosia — the catalogue (BAJAOVRLAY-43, pass 2)

Pass 1 (PR #19) designed six graphics: the race clock, the two towers, the lower strip, the
lower third and the sponsor bug. This pass designs the rest of the §9 catalogue in the same
language, as the spec the build briefs (BAJAOVRLAY-23 to 26) are written from. Every page is
generated from `../../sample-data.json` by `generatePages.mjs`; the shared markup is in
`../../tools/slateNotices.mjs`, `slateCards.mjs`, `slateBoards.mjs` and `slateSteps.mjs`, the
structure in `slate-cards.css` and `slate-boards.css`, and `motion.md` has the in, out and
steps. This page holds what a build brief needs beyond the picture: the layer plan, what can
share the screen, and each graphic's data needs (which canonical shape and fields it reads,
which fields do not exist yet, and whether it binds live or is typed by the operator).

The six graphics of pass 1 were checked against the new ones and did not change.

Since 2026-10-23 the pages show the 30ª Competição's real data (`../../README.md`, "The
sample data is real"): its teams and logos, the enduro's laps and penalties, the overall
scores, the Super Prime bracket and the sponsors by level. Two timelines replay the enduro
and the Super Prime at any moment of the day (`motion.md`, "The timelines"). Where the real
data does not fit a draft shape, the entry below says so.

## The layer plan

The layers as built (docs/00-concept.md §4): bug 10, ticker 20, clock 30, tower 35,
lower-third 40, fullscreen 50. One layer is proposed, **notice 45** ("Aviso"): the fastest lap
and the penalty notice must share the screen with the clock, the tower, the bug, the lower
third and the ticker, and no existing layer allows that (on the bug layer they would replace
the bug, which would then have to be taken again). A notice is transient: it leaves by itself
after `--motion-notice-hold` (8 s), and a new notice replaces the one on air once that one
has been up `--motion-notice-min-hold` (3 s), so two arriving close together are both read;
more queue in order (`motion.md`).

| Layer        | z   | Graphics                                                                                                             | Where on screen                                          |
| ------------ | --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| bug          | 10  | Sponsor bug; sponsor roll, corner                                                                                    | Top-left, x 96..428, y 54..178                           |
| ticker       | 20  | Lower strip; message ticker                                                                                          | Along the bottom, y 954..1026                            |
| clock        | 30  | Race clock; countdown (card)                                                                                         | Top-right, x 1404..1824, y 54..246                       |
| tower        | 35  | Compact tower; detailed tower                                                                                        | Under the clock, from y 254                              |
| lower-third  | 40  | Lower third; team card; QR card; battle card                                                                         | Bottom-left (the battle card bottom-centre), above y 940 |
| notice (new) | 45  | Fastest lap; penalty or incident notice                                                                              | Top-left under the bug, x 96..516, from y 186            |
| fullscreen   | 50  | Standings (overall, per event); bracket; podium; sessions board; intermission; countdown (full); sponsor roll (full) | The title-safe area (wide) or centred 1280 px (narrow)   |

## What can share the screen

Graphics on different layers can be on air together; two on the same layer cannot, so the
layer is also the rule of exclusion (a team card and a lower third never collide because
they are the same slot). The boxes above were drawn so that every cross-layer pair fits:

- **The everyday set**: clock + tower + bug, with a notice under the bug, a lower third, team
  card, QR card or battle card at the bottom, and the strip or the ticker along the bottom.
  All at once is possible and nothing overlaps (`combo-fastest-lap`, `combo-battle`,
  `combo-ticker` show the common three).
- **The battle card** sits bottom-centre so the lower third's slot and the column are free;
  it is on the lower-third layer, so it replaces a lower third rather than crowding it.
- **The ticker and the strip** both carry the clock block, so a race clock card top-right and
  the strip's clock show the same time; the ticker's block may be hidden with a switch, as
  the clock's flag band is.
- **Wide boards** (standings, bracket, podium) take the whole title-safe area: they are
  taken with the column, the notice and the ticker cleared (a macro: clear tower, clock,
  notice, ticker; take the board). The fullscreen layer is above the others, so a forgotten
  tower would simply be covered, never shown through.
- **Narrow boards** (sessions, countdown, intermission, sponsor roll) are 1280 px wide and
  centred, so the bug and the clock card stay visible beside them; the tower must be off
  (it runs the full height of the column) and the ticker may stay (the tallest narrow board,
  the sessions board, ends at y 877).

Combination screenshots: `combo-fastest-lap` (clock, tower, bug, fastest lap), `combo-battle`
(clock, bug, battle card), `combo-ticker` (lower third, message ticker).

## The graphics, one by one

Each entry: the page(s), what it shows, and its data needs. "Live" means the field binds to
a source and keeps updating on air; "snapshot" means it binds but is frozen at the take;
"typed" means the operator types it (or, later, picks it from the entity library,
BAJAOVRLAY-19). Fields that no canonical shape carries are listed as missing.

### 1. Team card — `team-card`, `team-card-sem-foto`

The lower third's slot with the car as the subject: the big blue chip, the team name at
44 px, the school and the city under it; a photo cell at the left and a logo cell at the
right only when the team has them. Without media the card is simply shorter, with the chip as
its anchor, so it never shows an empty frame. The photo, the logo and the city are each
optional (the motion demos show all eight combinations). The photo in the mock-up is a
stream frame standing in for a car photo (no car photos were handed over); the logo is the
team's real one, on the panel as it is, or on a small light plate when the mark is dark or
comes on its own white box (decided once per logo by `prepareLogos.mjs`).

- Reads: positions, one car chosen by its number (`entryOfCar.<n>`): `carNumber`,
  `teamName`, `schoolName`. Snapshot, or typed when the car is not in the positions.
- Missing: `city`, the photo, the logo, and a full school name ("Instituto Mauá de
  Tecnologia"), which the entity library will hold; until then the city is typed and the card
  has no media.

### 2. Battle card — `battle-card`, `sheet-battle`

Two cars fighting for one place, bottom-centre: each a 72 px pill (position in yellow, chip,
team over school, laps in green), the gap between them in a card at 44 px. The trend is a
word, the change since a lap ago with its sign, and a shape, so it reads in a still frame
and never only by colour or by motion: "▸◂ FECHANDO −0,7" in green, "◂▸ ABRINDO +0,7" in the
blue of the "down" cue (`--cue-down-text`), "— ESTÁVEL" in the muted text.

- Reads: positions, two cars chosen by number (or by place: position N and N+1): `position`,
  `carNumber`, `teamName`, `schoolName`, `laps`, and the car behind's `intervalMs` as the gap.
  Live.
- Missing: the trend. The shape has the interval now, not a lap ago. Proposed: the graphic
  keeps the interval it saw at the car behind's last lap change and derives the trend from it
  on each update, showing "ESTÁVEL" with no number until it has two readings; the operator can
  also set the trend by hand.

### 3. Standings — `standings`, `standings-por-prova`

Full screen. The overall table: a head card (logo, "CLASSIFICAÇÃO GERAL", the event, the
page), a column-head pill and 40 px pills, one per team: rank in yellow (rank 1 on the green
chip), chip, team with the school as a caption, one muted column per part of the score (the
real export's PROJETO, DINÂM., ENDURO, 4X4, SEG. and PEN.) and the total in green; a
disqualified team stays in the list, dimmed like a retired row, with "—" as its rank and
"DESCL." as its total. **20 rows a page** (three pages for the real 54 teams, the tower's page
size, so "page 2" means the same cars everywhere), the page held
`--motion-board-hold` (10 s); 20 rows of 40 px fill the height exactly (y 54..1018). An event
the source does not know shows "—". The per-event table has one number per team, so it shows
**the whole field at once in three columns of 20** (34 px pills, the tower's) and needs no
paging; tied teams share a rank (and, when that rank is 1, the green chip). The points per event are optional in the shape: overall
standings that come without them use the same three-column board with the total alone,
rather than seven columns of "—" (the motion demos show both).

- Reads: standings, scope `overall`: `rank`, `carNumber`, `teamName`, `schoolName`, `points`,
  `pointsByEvent` (optional per event). Per event: standings with the event's scope. Live or
  snapshot.
- Missing: the real overall score is not a sum of session kinds. It is design (PROJETO),
  the dynamic events together (DINÂM.), the enduro, the 4×4 bonus, safety (SEG.) and the
  penalties (PEN., negative). `pointsByEvent` keyed by session kind cannot carry that, so the
  shape needs its columns named by the source (a list of score parts, each with a label and a
  value). It also needs a disqualified mark on an entry.

### 4. Elimination bracket — `bracket-passo-1` to `-7`; `sheet-bracket-results`

Full screen, in steps, one per "Next". The eliminations routinely reach the round of 64 and
may reach 128, so a bracket is shown in two forms, and the generator picks between them from
the rounds alone. A round with more than four matches is a **round board**: a draw sheet in
two columns, read down the left column then the right, where each match is **one card** with
the two cars facing each other across a "×": chips on the outer edges, the results meeting
in the middle like a football score line ("2 BAJA UFMG 2 × 0 KOMIKETO 10", the real final), so who
runs against whom is never in doubt; the gutter between the columns is wider than the gap
between cards, so a row is never read across. 40 px cards, 32 matches a page, so a round of
64 is one page and a round of 128 two ("1ª rodada · página 1/2"). The last rounds,
from the quarter-finals (four matches) down, are the **tree**: one column per round under
its name pill, the matches of a round spread over the height and each centred between the
two it comes from, with the connecting lines, revealed one round per step; the round names
are all there from the tree's first step. An 8-car bracket is three tree steps; a 64-car one
three boards (1ª rodada, 2ª rodada, oitavas) and three tree steps; a 128-car one four boards
(its first round in two pages) and the tree. A longer tree was tried and dropped: eight
columns do not fit at a legible size, and a draw sheet is how a big round is read anyway.
The real Super Prime is a 64-slot draw: three boards (32 avos, 16 avos, oitavas), then the
quarter-finals, the semifinals and the final in the tree. The **third-place match** is not a
column: it sits at the foot of the final's column under its own name pill, with no line into
it, and gets its own step just before the final's, as it runs before it.

A match's **result is modular**, and the match says which kind it is by what it carries: a
count of wins per car when it is best of N (`bestOf`; "2" beside the winner, "1" or "0"
beside the loser), a time per car when it was a timed run ("1:11,3"), or nothing but the
winner's mark (a check on the winner's pill) when a win has no number; "—" on both while
undecided. In every form a decided match turns the winner's chip green and dims the loser
like a retired row.

**W.O.** overrides the result in any round and in either form: the winner carries an
outlined "W.O." tag in its result cell, in the winner's green, and the other car "—". Two
cases look different beside the tag. When the opponent did not run (absent, broken, out),
it is shown as a car like any loser, dimmed. When there is no opponent, a bye in a draw
short of a power of two, the other slot is empty: no chip, no team, a dashed outline reading
"SEM ADVERSÁRIO", so it can never be read as a car. The real draw is the extreme case: 33
cars in 64 slots, so the 32 avos board is 31 byes and one race. A W.O. reads the same in the
round of 64 as in the final. `sheet-bracket-results` shows all six states (time, best of 3,
plain win, W.O. by absence, W.O. without opponent, undecided) in both forms. The Super Prime
had no timed results, so the time rows there use sample times.

- Reads: brackets (draft shape, BAJAOVRLAY-25): `rounds[].name`, `matches[].carA` and
  `carB` (`carNumber`, `teamName`, `schoolName`, `timeMs`), `winnerCarNumber`. Live: a result
  arriving updates its match in place.
- Missing, for BAJAOVRLAY-25 against the Baja app's `tournament` table: `bestOf` on a match
  and `wins` per car (the sub-wins of a best of N); a walkover mark on a match (`walkover`,
  the winner advanced without racing); and a bye, which the draft shape cannot express since
  a match needs two different cars: proposed, `carB` left out for a bye, the winner being
  `carA` by W.O.; and a third-place match, which is not a round of the tree: proposed, a
  round marked `isThirdPlace`, its two cars the semifinals' losers.

### 5. Podium — `podium-passo-1`, `-2`, `-3`

Full screen, three cards on one baseline, 2nd at the left, 1st in the middle and taller, 3rd
at the right; each with the position at 72 px (yellow; the winner's on the green chip), the
big chip, the team at 44 px and the school. "Next" reveals 3rd, then 2nd, then 1st; a place
not yet revealed keeps its room but is invisible, so the cards already shown never move.

- Reads: positions, places 1 to 3 at the end of the session (`position`, `carNumber`,
  `teamName`, `schoolName`), or standings ranks 1 to 3 for the overall podium. Snapshot at
  the take.
- Missing: nothing.

### 6. Fastest lap — `fastest-lap`, `combo-fastest-lap`

The notice slot: a 420 px card under the bug with a green "MELHOR VOLTA" badge and the lap
in the head, then the chip, the team with the school, and the time at 44 px in green. It
leaves by itself after `--motion-notice-hold`.

- Reads: positions, the car with the smallest `bestLapMs` across the list: `carNumber`,
  `teamName`, `schoolName`, `bestLapMs`. Live (a new fastest lap replaces the card) or taken
  by hand.
- Missing: which lap it was set on. `bestLapMs` carries no lap number; the sample takes it
  from the real passes. A `bestLapNumber` field on the positions entry, or the operator types
  it. The export also credits missed laps in batches (many cars at the same second with
  near-zero lap times), so the sample ignores any lap under 2:45 as a lap time; a real source
  needs the same guard, or the fastest lap reads 0:00,0.

### 7. Penalty or incident notice — `penalty-notice`, `sheet-notices`

The same notice slot and card: a warning triangle and the kind (PENALIDADE or INCIDENTE) in
the head with where it happened at the right (the export's track sector, "SETOR E", or
"ANTES DA LARGADA"; "DIREÇÃO DE PROVA" when there is none), the chip and team, then the
reason and, when there is one, the penalty in a brand-navy cell. No flag
colour anywhere and no coloured band, so it cannot be mistaken for the clock's flag band
(`sheet-notices` puts the clock with a red flag beside it). The real reasons are long
("ULTRAPASSAGEM SOB BANDEIRA AMARELA"): the name and the reason each wrap to two lines rather
than being cut, and a long reason pushes the penalty to its own line. The unit is written in
words ("segundos") because the face has no lowercase and "+30 s" would read as "+30 S".

- Reads: positions, the car by number: `teamName`, `schoolName`. Typed: the kind, the reason,
  the penalty (optional).
- Missing: penalties. No shape carries them; if the Baja app exposes them (BAJAOVRLAY-18) a
  binding can follow, with the sector. The penalty export names a car number and a school but
  its numbers do not match teams.csv's, so the notices show the export's school as the name,
  with no team.

### 8. Countdown — `countdown`, `countdown-tela-cheia`

The card: the race clock's card without the band, on the clock layer, replacing the race
clock between sessions: the session to come in the head, "LARGADA EM" over the count at
56 px, the start time where the laps go. The full screen: a narrow board for the waiting
screen, the session at 56 px, the count at 160 px, the start time under it.

- Reads: the count is the race clock's clock group in `remaining` mode with the start as the
  reference (`referenceTimeMs` = time to the start, `referenceWallClockMs` = now, `running`),
  so the graphic counts by itself and nothing is retyped. Typed: the session name, the start
  time.
- Missing: the next session. The session shape describes the one running, not the next; the
  schedule (below) will give it.

### 9. Upcoming sessions board — `sessions-board`

A narrow board: a head (logo, "PROGRAMAÇÃO DO DIA", the event, the date) and one 64 px pill
per slot: the time at 44 px, the session at 34 px, the state at the right as a shape and a
word (a check mark and "CONCLUÍDA" muted; a play triangle and "EM ANDAMENTO" in green on
the denser slate; a hollow circle and "A SEGUIR"). Nine slots fit with room to spare; the
board grows with the schedule up to about twelve.

- Reads: nothing canonical. Typed: the schedule (time, session, state), until the entity
  library holds schedule slots; the "em andamento" state could later follow the session shape
  (`sessionName`).
- Missing: a schedule shape or entity.

### 10. Intermission board — `intermission-board`

A narrow board for a break: the head ("INTERVALO", the event, the date), a card with what is
next (the session at 56 px, the count at 96 px, the start time), the overall top five as
40 px standings pills, and a sponsor line with up to four marks and names. The top five and
the sponsor line are each optional (before the first standings exist, or with no sponsor to
show); without the top five the next-session card takes the whole width, its words centred.

- Reads: session `eventName` (live or typed); standings rows 1 to 5 (live); the countdown's
  fields as in 8; the sponsors as in 11.
- Missing: the next session, and the sponsors, as in 11.

### 11. Sponsor roll — `sponsor-roll`, `sponsor-roll-canto`

Full screen: a narrow board with up to six tiles a page (the logo in a 340 × 150 box and the
name at 34 px), **one sponsor level a page**, the level in the head ("PATROCÍNIO DIAMANTE"),
centred when a page has fewer than six; the page turns every `--motion-sponsor-hold` (5 s).
The real 16 sponsors in three levels (diamante, ouro, apoio) make four pages. Corner: the
bug's card with a sponsor cell ("PATROCÍNIO DIAMANTE" over the logo) under the event word,
the cell changing on the same hold. Logos follow the same plate rule as the team card's.

- Reads: nothing canonical. Typed: the names and levels, until the entity library holds
  sponsors with their logos.
- Missing: a sponsor entity with artwork and a level.

### 12. QR card — `qr-card`

The lower third's slot, the one light surface (white at 96%, dark text) so the code scans
off a phone pointed at a screen: a 176 px code, the call to action at 34 px, the address at
26 px (in caps like everything else; the host part of an address is case-insensitive).
The code in the mock-up is a placeholder pattern and does not scan.

- Typed: the call to action and the address. The graphic makes the code from the address
  when it loads (a QR encoder in the package, nothing from the network), so a wrong address
  is seen in the preview.
- Missing: nothing.

### 13. Message ticker — `message-ticker`, `combo-ticker`

The strip's bar on the ticker layer with the strip's clock block, then an "AVISO" label pill
in the denser slate and one message pill at 30 px, one message per page, the page cell at
the right. It differs from the standings strip at a glance: one pill, a label, no chip, no
yellow and no green. The clock block is optional (off when the race clock card is up, or
between sessions); without it the label starts the bar. Messages page like the strip's cars
(`--motion-strip-hold`, 7 s) and never scroll.

- Reads: the clock block as the strip does (the clock group and the flag, live). Typed: the
  messages, a list.
- Missing: nothing.

## Tokens added in pass 2

Listed in `README.md` ("Tokens added in pass 2"), all in `tokens.css` under "The catalogue".
