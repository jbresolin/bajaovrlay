# placar — the timing board

Direction "placar" for BAJAOVRLAY-22. Pages, tokens and styles are in this folder; the
screenshots João chooses from are in `screenshots/`. Every `.html` here is written by
`generatePages.mjs` (in this folder) from `../../sample-data.json`, so no row is typed by
hand and a fix regenerates every page: `node docs/design/directions/placar/generatePages.mjs`
from the repo root. `motion-demo.js` is the demo's script, loaded by `motion-demo.html` with
a relative `<script src>`; `tokens.css`, `styles.css`, `README.md` and `motion.md` are written
by hand.

## A ideia

A solid timing board. Every graphic is an opaque navy plate with hard corners, a 6px
brand-green spine on its left edge and tight white condensed type, so it reads like a
scoreboard: information first, decoration none.

Base plate brand navy `#003B71`; secondary cells (position column, header strips, role
plate, ENDURO label) a lighter navy `#0B4F8F`; the leader's position cell brand green; a
brand-blue cell for the team tag and the "moved down" cue. Brand yellow `#F4C42A` is not
used anywhere in this direction and has no token in `tokens.css`: a yellow field could only
be read as a yellow flag. Corners 0px, no shadows. The lines in the system are a 1px
`rgba(0,0,0,.35)` edge inside the bottom of each plate (separation from bright sky), a 1px
`rgba(0,0,0,.22)` line between tower rows and a 1px white-at-16% divider between strip cells;
nothing else. A cell that paints its own colour down to a plate's bottom (the clock's flag
band, the strip's flag cell, a tower's position cell) carries the line itself, so the line is
never hidden under it and runs the full width of the clock, the strip and every tower row.

The clock, the compact tower and the lower third are all 420px wide: one left column with
one edge, from the top of the clock to the bottom of the tower, and the same edge again where
the lower third sits over the strip.

## Legibility at 720p on a phone

- Checked on a 1280x720 render of `combo-tower.html` over frame 1 (Chromium at a 2/3 device
  scale, in the scratchpad): every row of the 24-row tower, every car number, the "P" pit icon
  and the clock read; the 20px captions become 13px and stay readable as labels, which is all
  they are.
- Every size on air, at 1080p (and at 720p): clock time 72px (48); lower-third name 48px (32);
  strip time 44px (29); the whole lower strip at 28px (19): positions, car numbers, school
  names, flag word, page indicator and session name; 26px (17): numbers and team names in
  both towers, the leader's position cell, the flag word in the clock band, the session name
  in the clock, the role in the lower third and the detailed tower's VOLTAS and ABAST.
  figures; 24px (16): the laps column of the compact
  tower, the clock's "34 VOLTAS", the detailed tower's gap, interval, last lap and best lap,
  and the lower third's team tag; 22px (15): school names in the detailed tower, the clock's
  "TEMPO RESTANTE" caption and the ENDURO label of the bug; 20px (13), the floor: the tower
  headers ("POSIÇÕES", "VOLTA 34", the detailed tower's column labels) and both lines of the
  bug's sponsor cell ("APRESENTADO POR" and the sponsor name). Nothing on air is below 20px.
- Opaque plates: text never competes with the footage, and there is no translucency for the
  stream encoder to smear a bright sky through. This holds for a retired row too: the dimming
  is applied to the row's cells (text, icons, position cell), not to the row, so the row's navy
  and its 6px of spine stay opaque and the dimmed text is white at 55% over navy, never over
  the footage.
- Barlow Condensed 700 for numbers, times and names: narrow, open counters, tabular figures
  everywhere (`font-variant-numeric: tabular-nums` on `body`), so a counting clock and the
  gap column never jitter.
- Compact tower 26px numbers and names in 32px rows (17px / 21px at 720p); lower strip 28px
  everywhere, session name included; captions 20px, nothing smaller on air.
- Status icons are 20px white glyphs with 2px strokes in a fixed 28px column, three different
  shapes (P in a square, triangle, circle with a slash); a retired row's cells are also dimmed
  to 55%, and the dimmed white text measures 4.50:1 on base navy.
- The flag word is always printed beside its colour, at 26px in the clock band and 28px in
  the strip, letter-spaced so it survives compression.

## Safe areas

Everything on air stays inside x 96..1824, y 54..1026; `tools/checkLayout.mjs placar` passes
on every page. Boxes as measured by the tool:

| Graphic | Box (x, y) | Size |
| --- | --- | --- |
| race-clock | 96..516, 54..214 | 420 x 160 (36 session + 80 time + 44 flag band) |
| positions-compact | 96..516, 226..1026 | 420 wide, 32 header + 24 rows x 32 |
| positions-detailed | 96..1112, 226..1018 | 1016 wide, 32 header + 20 rows x 38 |
| lower-strip | 96..1824, 954..1026 | 1728 x 72 |
| lower-third | 96..516, 836..940 | 420 wide, 64 name + 40 role row; bottom at 940 (above the strip) |
| sponsor-bug | 1584..1824, 54..254 | 240 x 200: logo cell 120, label 28, sponsor 52 |

The tower is a left column, the bug a small corner, the clock a top-left card: the centre of
the frame, where the cars are, stays clear. Deviations from the brief's starting values and
why: the clock, the compact tower and the lower third share one width, 420, instead of the
brief's 440 for the clock and 380 for the tower (the first draft had a 480 clock over a 380
tower, a 100px step down the left edge; the review made them one column). In the clock's
386px of text room (420 less the 6px spine, 12px left and 16px right padding) the 72px time
"1:16:00" is 220px and the caption "TEMPO RESTANTE", set in Barlow Condensed 600 22px tracked
.06em, is 155px, so they sit side by side with 11.5px of navy between them (measured in
Chromium: nothing wraps, nothing clips) and the clock stays 160 tall, which keeps the 24
rows. The bug is 240 wide, not 200, so the logo keeps clear navy around it, and 200 tall: the
logo cell 120 (the logo 112 tall, 146 wide at the artwork's 4118x3150), the ENDURO label 28
and a 52px sponsor cell of two 22px lines, "APRESENTADO POR" at 20px over the sponsor name at
20px 700 ("Metalúrgica Serrana" is 146px, in 210 of room). The detailed tower is 1016, not
~900, because each timing column is its header label plus 16px of clear navy before the next
label, rounded up to the 4px grid (at 20px Barlow tracked .04em: "INTERV." 76px gives 92,
"ÚLT. VOLTA" 106px gives 124, "MELHOR" 79px gives 96, "ABAST." 69px, centred, gives 88), with
two exceptions: VOLTAS is its label (72px) plus the 8px padding, 80, because what sits to its
left is the right-aligned school text rather than a label, and the laps figure is 54px clear
of it; DIF. is its widest figure ("+10 voltas" at 24px, 90px) plus 8px padding plus 10px of
clear navy, 108, so a lapped car's gap never runs into the laps figure beside it ("+22 voltas"
starts 18px after the "12" of the retired car 96, measured in Chromium; the narrowest
laps-to-gap clearance on page 1 is 29px); the team column is 274 so the widest
team-plus-school pair in the sample fits (see "Tower rows"), and every row has a 16px cue
lane; the strip's car cells are two lines (see "The lower strip"). The lower third is a fixed
420 rather than the width of its text: the name plate is 64 tall, the role row 40, and a name
or a role longer than the plate takes the ellipsis (the team tag never does; in the sample
the role cell is 236 and the tag 184). Text starts 12px after the spine (x 114) on every
plate, the lower third included.

## Contrast

Computed with `tools/contrastRatio.mjs`; every panel is opaque, so no composite over the
footage is needed. A retired row's cells sit at 55% over the row's own navy, so those rows
composite over `#003B71`. The flag set is the palette shared by the three directions, so the
directions are compared on their look and not on their flag colours.

| Text | Panel | Ratio | Where |
| --- | --- | --- | --- |
| #FFFFFF | #003B71 base navy | 11.27:1 | all plates: names, numbers, times, clock |
| #FFFFFF | #0B4F8F lighter navy | 8.30:1 | position cells, header strips, role plate, ENDURO label |
| #B9C8DB | #003B71 base navy | 6.62:1 | captions, laps in the compact tower, school names, interval and best lap |
| #B9C8DB | #0B4F8F lighter navy | 4.88:1 | not used on air (header captions are white on the lighter navy, 8.30:1); listed because the brief asked for the pair |
| #FFFFFF | #009739 brand green | 3.83:1 | leader's position cell and the "moved up" cue, 26px bold: large text only |
| #FFFFFF | #386DB4 brand blue | 5.23:1 | team tag cell, "moved down" cue cell |
| #FFFFFF | #5B6472 flag pre | 5.98:1 | PRÉ-LARGADA band |
| #FFFFFF | #15803D flag green | 5.02:1 | VERDE band: white word, AA for normal text |
| #111111 | #FFD600 flag yellow | 13.37:1 | AMARELA band |
| #FFFFFF | #DC2626 flag red | 4.83:1 | VERMELHA band |
| #F5F5F5 | #111111 checkered plate | 17.32:1 | QUADRICULADA word on its dark plate over the squares |
| #FFFFFF | #1F2937 flag finished | 14.68:1 | ENCERRADA band |
| #8CA7BF (white at 55% over navy) | #003B71 base navy | 4.50:1 | retired row: name, number, laps, school, gaps, times and the status icon (every text in a retired row is white before the dimming) |
| #8CA7BF | #064682 (lighter navy at 55% over navy) | 3.81:1 | retired row's position cell, 26px bold: large text only |
| #6689AB (muted at 55% over navy) | #003B71 base navy | 3.07:1 | not used: it would fail AA for the 22px school name, which is why a retired row's muted cells turn white before the dimming |
| #FFFFFF | #003B71 / #0B4F8F | 11.27 / 8.30:1 | status icons (same as text) |

## Tower rows

Compact: **24 rows** (positions 1..24). The budget from the top: clock 54..214 (160px), 12px
gap, header strip 32px at 226..258, then 24 x 32 = 768px ending exactly at 1026. The header
is 32px rather than the brief's 36 because 36 leaves 760px for rows, one row short of 24; a
23-row tower would waste 24px at the bottom. Rows are 32px with 26px type, the minimum the
brief allows, so 24 is the maximum this layout fits. Columns (px, after the 6px spine):
position 40, cue lane 16, car number 48, team 238, laps 36, status 28, then 8px of right
padding. The row line runs the full width of the row, position cell included: the cell
carries the line itself, since its lighter navy would otherwise cover the row's. The leader's
green cell starts 4px after the spine, on the row's own navy (the row line shows through the
gap), so the spine and the cell never read as one 46px green block; the grid column stays 40
and the cell is 36, which holds the "1" with room (a "moved up" cue cell is green too and gets
the same 4px, motion.md). The cue lane is empty navy until a position change puts the ▲ or ▼
in it (motion.md): a 14 x 10 triangle cannot share a 40px cell with a two-digit position, so
it gets its own 16px right after the cell, and the lane takes the cell's colour while it
shows. "Lobo-Guará Off-Road" (191px at 26px 600) fits the 238px team cell with 47px to spare;
anything longer than 238 gets the ellipsis.

Detailed: **20 rows** of 38px plus a 32px header (the compact header's height, so the two
towers share one), 226..1018, 1016 wide; a 21st row would end at 1056, outside the safe area,
so 8px stay unused at the bottom. Columns (px): POS 48 (the leader's green cell inset 4px, as
in the compact tower), cue lane 16, Nº 48, EQUIPE 274 (team name, then school name in muted
22px; the team name takes the ellipsis, the school never does), VOLTAS 80, DIF. 108, INTERV.
92, ÚLT. VOLTA 124, MELHOR 96, ABAST. 88, status 28. The team cell has 258px of text room
after its 2 x 8px padding; the widest team-plus-school pair in the sample (measured in
Chromium at 26px 600 + 8px + 22px 600) is "Cascavel Off-Road" + "UNIOESTE" at 253px (position
59), so every pair in the sample fits on its page, and on page 1 the widest, "Jequitibá
Racing" + "CEFET-MG", is 238px; a longer real team name takes the ellipsis. The header labels
are tracked .04em (the title tracking) rather than the captions' .08em: at .08em the letters
inside a label sit ~3px apart and neighbouring labels only ~10px, so "DIF. INTERV. ÚLT. VOLTA
MELHOR ABAST." read as one run; at .04em each timing column is its label plus 16px (VOLTAS
and DIF. aside, see "Safe areas"), so the navy between neighbouring labels measures
DIF.→INTERV. 16.4, INTERV.→ÚLT. VOLTA 18.0, ÚLT. VOLTA→MELHOR 17.2 and MELHOR→ABAST. 17.6. A
header cell has the same padding as the cells under it (right-aligned columns pad 8px on the
right only, ABAST. is centred with none), so every label ends exactly where its figures end:
VOLTAS and the laps both end at x 560, ABAST. and the pit-stop figures share their centre at
x 1032. The leader's empty DIF./INTERV. cells stay empty rather than show a dash: nothing is
typed that is not in the data.

## The lower strip

Paging, not scrolling: **10 cars per page, 6 pages for 60 cars, 7 s per page, hard cut with a
150ms left-to-right wipe** (motion.md). Scrolled text smears under stream compression (every
frame differs, so the encoder spends its bits on the ticker and the glyphs blur), judders in
OBS whenever the browser's frame rate and the output rate are not multiples, and cannot be
read at 28px on a phone while it moves; a page stays still for 7 s, which is enough to find a
car and read its school. Each car cell is two 32px lines tall: a position chip (lighter navy,
green for the leader) and the car number on the first line, the school name on the second,
all at 28px. Ten cars at 28px do not fit on one line in the space the strip has for them
("2 · 38 · EESC-USP" alone is ~190px), so the brief's one-line cell became two lines rather
than smaller type. The "short team name" is `schoolName`, which the canonical shapes define
as the short form (e.g. "UFPR").

The left block is 428 wide under a green flag: the 6px spine, a fixed 302px cell with the
session name at 28px over the time at 44px (278px of text room; "ENDURO DE RESISTÊNCIA" is
265px, a longer session name gets the ellipsis), and the 120px flag cell with the word. A 12px
navy gutter separates the flag cell from the first car, so the flag colour and the leader's
green chip never read as one field; the first car cell has no divider line, the gutter
separates it (the other nine cells and the page indicator each carry one on their left). Then
ten car cells of 124px and the 48px page indicator
"1/6". A longer flag word widens its cell and the block, and the ten cells share what is left
(measured in Chromium): AMARELA 434 / 123.4, VERMELHA 447 / 122.1, ENCERRADA 461 / 120.7,
PRÉ-LARGADA 488 / 118.0, QUADRICULADA 525 / 114.3. The widest short name in the sample,
"CEFET-MG" (97px), needs 113 with its 2 x 8px padding, so it fits in every state, with 1px to
spare under the checkered flag; a longer short name would get the ellipsis in that state only.

## Extending to the §9 catalogue

- Team card: a wide plate, photo cell on the left (lighter navy frame), name 48px with the
  spine, school and car number in a blue tag row.
- Battle card: two plates facing each other with a 12px gap, each with its own spine, the gap
  between the cars in a shared secondary cell in the middle.
- Podium: three plates rising (heights 3:2:1), green spine on the winner only, position
  numbers in the position-cell style.
- Bracket: plates on 2px navy lines, each plate a compact row (position cell, number, name).
- Standings table: the detailed tower's rows with a PONTOS column in 26px 700 instead of the
  timing columns (sample `standingsTop5` fits as is).
- Intermission board: full-screen navy with a 24px green spine, the event name in 72px and
  the next session's name and time in the clock's row style.
- Sponsor roll: the bug's sponsor plate, widened, one sponsor per 7 s page with the same
  150ms wipe as the strip.
- Countdown: the clock without its flag band, time 72px, caption "LARGADA EM".
- Penalty notice: a plate with a band in the red flag-set colour, car number and team in the
  compact row style, the penalty text 26px.
- Fastest lap: a plate with the time at 72px and a green "MELHOR VOLTA" cell (white 26px
  bold on brand green, large text only), car number and team beneath.
- QR card: a plate with a white QR cell on the right and the call to action at 26px; the
  spine stays green.

## Type

Barlow Condensed 700 for numbers, times, car numbers, the clock and the lower-third name;
Barlow Condensed 600 for team names, session names, roles and school names; Barlow 600 at
20–22px, uppercase, letter-spacing .08em for captions and .04em for the detailed tower's
column headers (see "Tower rows"). One caption is the exception: the clock's "TEMPO RESTANTE"
is Barlow Condensed 600 at 22px tracked .06em, because in Barlow at 20px it is 185px wide and
does not sit beside the 72px time in a 420px clock; condensed it is 155px and does. Both
families are self-hosted OFL (`fonts/README.md`) and both answer tabular figures. Urzeit,
when it arrives, could set the session name in the clock, the ENDURO label in the bug and
the intermission board's title: display words only, never a number, because its figures are
not known to be tabular.

## Decided in the review (no longer open)

- One 420px left column: clock, compact tower and lower third, with the time at 72px and the
  caption in Barlow Condensed; the tower's extra 40px went to the team column (198 → 238).
- The flag palette is shared by the three directions; the VERDE band is `#15803D` with a
  white word (5.02:1), no longer `#1DB954` with a dark one.
- The leader's green position cell is inset 4px from the spine.
- The sponsor bug is 200 tall (was 264); both towers have a 32px header (the detailed one was 36).

## Open questions for João

1. The lower strip's cells are two lines (position + number over school). The one-line
   alternative at 28px is 8 cars per page (8 pages).
2. The lower third's team tag shows "Acauã Baja · Mauá"; should the car number ("Nº 31", in
   the data) join it?
3. The detailed tower is 1016 wide; is covering just over half the frame acceptable for an
   occasional graphic, or should it drop MELHOR (96px) to come back to 920?
