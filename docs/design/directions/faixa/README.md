# Faixa — the stripe

## A ideia

White plates with navy type and a bold angled stripe, like a race number plate or a sticker
on a car: light, loud, sporty. The stripe (a 12° skew) is the one gesture every graphic
repeats, and the clock's stripe is the flag itself.

Every plate is near-opaque white (`rgba(255,255,255,.96)`) with a 6 px brand-green stripe on
its top edge and a 3 px navy rule on its bottom edge; its header is a navy ribbon whose right
end is cut at 12° and overhangs the plate by its own run. On the clock and the towers the
stripe is painted on the header ribbon and the clock's rule on the flag band, so both follow
the 12° cap instead of stopping at the plate's edge, 9.8 px short of the cap's tip (the ribbon's
run: 46 px × tan 12°, measured 9.77 px; the same number is in `styles.css`). Text is navy;
captions are muted slate. Flag colours exist only on the clock's bottom band and the strip's
flag cell, so a navy ribbon never reads as a flag. Brand yellow is declared in `tokens.css`
and used nowhere.

The sponsor bug's left edge is cut at the same 12°, parallel to every ribbon cap, and its green
stripe ends on the angle like the ribbons' stripe: the right corner repeats the left column's
gesture instead of mirroring it (the brief's "bottom-left corner cut" is the mirror image; open
question 7). In the strip the brand-green stripe starts where the white part starts, so no
green line runs over the navy clock block and nothing green sits above the flag cell; the cell
is 44 px tall (the time's line box), centred in the 69 px block with 12.5 px of navy above and
below. The flag green (`#15803D`) is not the brand green (`#009739`) on purpose: the flag set
is the one shared by all three directions, and the brand green is never a flag.

Plates carry a `box-shadow`, not a `filter: drop-shadow`: the tower's rows live inside the
plate and a filter re-rasterises the whole plate every time a row moves. The shadow therefore
follows the plate's rectangle, and the ribbon's 9.8 px overhang and the flag band's cap have
no shadow of their own (a box-shadow on the ribbon would be cut by its own clip-path). The
sponsor bug alone keeps a drop-shadow, on a wrapper, because its plate is clipped at the corner.

Pages: `race-clock`, `positions-compact`, `positions-detailed`, `lower-strip`, `lower-third`,
`sponsor-bug`, `combo-tower` (clock + compact tower + bug), `combo-strip` (strip + lower
third), `sheet-flags`, `sheet-status`, `motion-demo`; `tokens.css`, `styles.css`, `motion.md`.
Every `.html` here is generated: `generatePages.mjs` (in this folder) writes them from
`../../sample-data.json`, so no row is typed by hand and a fix regenerates every page:
`node docs/design/directions/faixa/generatePages.mjs` from the repo root. `tokens.css`,
`styles.css`, `README.md` and `motion.md` are written by hand.

## Legibility at 720p on a phone

Checked on a 1280×720 downscale of `combo-tower` over frame 1 (orange dirt and bright sky).
The compact tower's numbers are 26 px Saira 700 and names 27 px Saira Condensed 600 at 1080p
(17 px and 18 px at 720p), on white with navy at 11:1, so they stay readable where a dark
glass panel would have lost its edges in the dust. White plates with a hard shadow separate
from the footage without relying on blur. The status icons are 20 px line glyphs with 2 px
strokes; at 720p the "P", the triangle and the slashed circle still read as three shapes.
The clock is 72 px; every text in the strip is 28 px (19 px at 720p), nothing smaller is in
it; the lower third's team line is 22 px; nothing on air is under 20 px.

## Safe areas

Everything on air sits inside x 96..1824, y 54..1026 (`tools/checkLayout.mjs` passes):

| Graphic | Box |
| --- | --- |
| Race clock | x 96..536, y 54..227 (440 wide, 173 tall; the ribbon's and the band's caps overhang to x 546) |
| Compact tower | x 96..536, y 239..1024 (440 wide, 23 rows; its cap overhangs to x 546 like the clock's) |
| Detailed tower | x 96..1236, y 239..1008 (1140 wide, 20 rows) |
| Lower strip | x 96..1824, y 954..1026 (72 tall) |
| Lower third | x 96..536, y 775..940 (min 440 wide, grows with the name) |
| Sponsor bug | x 1544..1824, y 54..258 (280 wide, 204 tall) |

The clock and the compact tower share one right edge, so the left column reads as one stack
of plates with one angled silhouette (the brief's 380 px tower stepped in by 60 px under the
clock). The bug is a corner, the clock a small card: the middle of the frame stays free. The
lower third ends 14 px above the strip's room so both can be on air together.

## Contrast

Measured with `tools/contrastRatio.mjs`; the white plate is checked at alpha .96 over the
bright-sky worst case `#E8EEF5`. Everything passes AA; brand-green fields carry large bold text
only (the flag green, `#15803D`, passes at any size). The flag palette is the one shared by all
three directions.

| Text | Panel | Ratio | Where |
| --- | --- | --- | --- |
| `#003B71` navy | white plate `.96` over `#E8EEF5` | 11.20:1 | numbers, names, times, the clock |
| `#4C5A6B` muted | white plate `.96` over `#E8EEF5` | 7.00:1 | captions, laps, interval, fuel stops |
| `#003B71` navy | `#F1F4F8` alternate row | 10.21:1 | every second tower row |
| `#4C5A6B` muted | `#F1F4F8` alternate row | 6.38:1 | muted numbers on alternate rows |
| `#003B71` navy | `#F1F4F8` strip page cell | 10.21:1 | the strip's page cell, 28 px bold ("1/12") |
| `#386DB4` blue | white plate `.96` over `#E8EEF5` | 5.20:1 | the lower third's team line (22 px) |
| `#FFFFFF` white | `#003B71` navy ribbon | 11.27:1 | ribbons, position cells, strip clock |
| `#D9E2EC` muted white | `#003B71` navy ribbon | 8.61:1 | "VOLTA 34" and column captions on ribbons |
| `#FFFFFF` white | `#009739` brand green | 3.83:1 | leader cell 26 px bold and the moved-up cell with its 14 px solid SVG mark (AA large) |
| `#FFFFFF` white | `#386DB4` brand blue | 5.23:1 | moved-down position cell, 26 px bold with the same mark |
| navy at .7 (≈ `#4C769B`) | white plate `.96` over `#E8EEF5` | 4.79:1 | a retired row's number and name |
| muted at .7 (≈ `#818B97`) | white plate `.96` over `#E8EEF5` | 3.42:1 | a retired row's laps, 24 px (AA large) |
| navy at .7 (≈ `#48739A`) | `#F1F4F8` alternate row | 4.56:1 | a retired row's number and name, alternate row |
| muted at .7 (≈ `#7E8895`) | `#F1F4F8` alternate row | 3.25:1 | a retired row's laps, alternate row (AA large) |
| `#FFFFFF` white | `#5B6472` flag pre | 5.98:1 | PRÉ-LARGADA band and strip cell |
| `#FFFFFF` white | `#15803D` flag green | 5.02:1 | VERDE band and strip cell (AA at any size) |
| `#111111` | `#FFD600` flag yellow | 13.37:1 | AMARELA band and strip cell |
| `#FFFFFF` white | `#DC2626` flag red | 4.83:1 | VERMELHA band and strip cell |
| `#F5F5F5` | `#111111` word plate on the checkered pattern | 17.32:1 | QUADRICULADA |
| `#FFFFFF` white | `#1F2937` flag finished | 14.68:1 | ENCERRADA band and strip cell |

A retired row is dimmed to .7 (`--row-retired-opacity`), not the brief's .5: at .5 the navy
fell to 2.82:1 and the muted laps to 2.27:1, under AA for large text, and .7 is the lowest
value at which every pair in the row passes (the muted laps on an alternate row, 3.25:1, is
the tightest). The dimming is applied to the text cells, not the row, so the status icon that
says "retired" stays at full strength, and so does the navy position cell (white on navy,
11.27:1): the position column stays one continuous navy stripe down the tower.

## Tower rows

**Compact: 23 rows.** The clock is 173 px tall (46 ribbon with its stripe + 80 body + 47 flag
band with its rule), the tower starts 12 px under it at y 239, and its own header is 46 px,
which leaves 1026 − 239 − 46 = 741 px: 23 rows of 32 px (736) plus the 3 px rule fit; a
24th would end at y 1056. The brief's target of 24 needs 32 px more than the clock can give
without dropping its flag band or its ribbon, so 23 is the number. Rows alternate white and
`#F1F4F8`; the position cells form a continuous navy column (green for the leader); names are
27 px Saira Condensed with ellipsis. The position cell is 52 px, not the brief's 40: it is sized
for a two-digit position with its move mark ("13" at 32 px + 2 px + a 14 px mark = 48 px), and
50 of the 60 cars have two digits. At 440 px the name column is 268 px (252 inside its padding)
and the longest name in the field, "Lobo-Guará Off-Road" (200 px), leaves 52 px; at the brief's
380 the column would be 208 px (192 inside) and that name would be cut.

**Detailed: 20 rows of 36 px, 1140 px wide.** The same top (y 239) with 787 px of room and a
46 px header leaves 741 px: 20 × 36 = 720 (y 1008). The brief's 38 px rows would give 19;
20 rows at 36 px keeps the 60-car field on three pages. The column captions sit on the ribbon
itself, so no caption row is spent. Why 1140 and not the brief's ~940: Saira is a wide face.
Every numeric column holds its caption and its widest value in the 60-car field with 12 px of
padding on the 4 px grid, and is wide enough that at least 24 px separate its caption from the
caption before it (captions are right-aligned, so that gap is the column's width minus its own
caption's): VOLTAS 92 (caption 80), DIF. 132 ("+10 voltas" 117; 93 px after VOLTAS), INTERV.
112 ("+109,0 s" 97; caption 83, 28.6 px after DIF.), ÚLT. VOLTA 144 (caption 118, 26 px after
INTERV.), MELHOR 116 (caption 91, 24.8 px after), ABAST. 104 (caption 78, 25.8 px after). The
position cell is 52 px like the compact tower's (a two-digit position with its mark is 45.5 px
at 24 px), and so are the car number column (52: "31" is 30 px plus 8 of padding) and the
status column (28: a 20 px icon with 4 px each side). The team column takes the rest, 308 px
(288 inside its padding), and the widest team-plus-school pair in the field, "Cascavel Off-Road
UNIOESTE" at 272 px, leaves 16 px of slack. 1140 is the ceiling the lead set: the three caption
gaps cost 36 px and the slack 16, and the number and status columns gave 12 back.

## The lower strip

72 px tall, from x 96 to 1824. Left, a navy block of at least 400 px, 69 px tall from the
strip's top edge down to its navy rule (the green stripe starts where the white part starts,
so no green runs over the block or above the flag cell), with the time (44 px) and the flag
word in a skewed flag-coloured cell that takes the rest of the block (44 px tall, the time's
line box, centred with 12.5 px of navy above and below; on the checkered flag the word's dark
plate is a parallelogram like the cell, 36 px tall like the position cells, inside a 12 px
checkered frame, which is why that one cell carries 24 px of padding); then the cars in equal
cells, separated by skewed navy hairlines; right, the page cell `1/12`, 92 px wide (fixed,
sized for "12/12", so the car area is the same on every page). Each car reads position
(white on a navy mini cell) · car number · short team name. The short team name is the
**schoolName** of the canonical shape ("UFPR", "EESC-USP"): it is the short form by
definition, and at 28 px it is what fits.

The strip carries **no session name**. The brief asked for one at 20 px, but the shared rule
puts every strip text at 28 px, and a 28 px line over the 44 px time does not fit the 69 px
between the strip's top edge and the rule (the block carries no stripe). The clock plate names the session whenever the tower is up;
the strip-plus-lower-third combination shows time, flag and positions (open question 6).

The leader's cell is **navy** in the strip, not green: the flag cell sits 30 px from it, and a
green cell beside a yellow flag cell would read as a second flag. Only the towers keep the
green leader cell, far from any flag colour.

The block is 400 px under VERDE, AMARELA, VERMELHA and ENCERRADA, so the hairlines do not move
at those flag changes; PRÉ-LARGADA widens it to 427 and QUADRICULADA to 471, which leaves
1165 px for the cars (1209 under PRÉ-LARGADA, 1236 under the short words). Car cells carry
10 px of padding (not 12) and position cells 4 px.

**Equal cells, 5 cars per page, 12 pages.** Every cell is one fifth of the car area whatever
it holds (233 px under QUADRICULADA, 247 under the short words), so no page stretches: a page
with fewer cars shows them in cells of the same width and leaves the rest of the bar empty
(with 60 cars every page is full). Five, not the brief's 10 nor the earlier content-sized 7:
the widest cell in the field is 211 px (position 19, car 42, CEFET-MG: a two-digit position
cell, the number and the school), and equal cells must each hold it under every flag word.
Six per page would give 194 px under QUADRICULADA and 206 under VERDE, cutting CEFET-MG,
UNICAMP, EESC-USP and UNIVASF; seven would give 167. Five leaves 22 px of slack on the widest
cell under the widest word, and nothing is ever truncated. Pages turn every 7 s with an angled
wipe (400 ms); the field takes 84 s. Paging beats scrolling because a page sits still: a viewer
reads five cells at rest, twice, where a ticker keeps every cell moving over moving footage
and nothing is ever readable at a glance; and the wipe is the same gesture as every entrance,
so it reads as "next page", not as a change in the race.

## Extending to the §9 catalogue

Every graphic is a white plate with a green top stripe, a navy ribbon and the 12° edge.

- Team card: a photo plate with the car number on a navy mini cell and the team name on the
  ribbon, the school as a caption, the stripe cutting the photo's corner.
- Battle card: two plates side by side, the gap on a navy ribbon between them, the leading
  car's position cell green.
- Podium: three plates with ribbons 1º 2º 3º, the first one taller, the stripe linking them.
- Bracket: plates connected by 3 px navy lines, each match a ribbon with the two numbers.
- Standings table: rows like the detailed tower with a points column (`pointsText`) on the
  right; the ribbon reads "CLASSIFICAÇÃO".
- Intermission board: a large white plate centred, not full-screen; the session name on a
  ribbon and the next session's time in the clock's 72 px.
- Sponsor roll: white plates cycling with the angled wipe, each with one logo and the
  "Apresentado por" caption, in the bug's corner.
- Countdown: the clock plate without the flag band; the ribbon says what is being counted.
- Penalty notice: a plate with a red flag-set ribbon (`--flag-red-background`), the car on a
  navy mini cell, the penalty text 24 px.
- Fastest lap: a plate with the time at 48 px and a green ribbon "MELHOR VOLTA", car and
  team beneath.
- QR card: a white plate with the code on white (it scans), a navy ribbon with the call to
  action; nothing skewed near the code.

## Type

Saira (OFL) for numbers, times, titles and captions: 700 for numbers and titles, 500 for
captions (20–22 px, uppercase, tracked .06em), always `tabular-nums`. Saira Condensed 600 for
team names only, because it has no tabular figures: no number is ever set in it (the strip's
school names are words; the flag words stay in Saira). Urzeit, the event's display face,
could later set the ribbon titles ("POSIÇÕES", the session name) and the lower third's name
as an accent; every number stays in Saira.

## Open questions for João

1. The detailed tower is 1140 px wide, not ~940. Its numeric columns are at their minimum
   for 24 px between captions (see "Tower rows"), so the only ways down are dropping INTERV.
   (to 1028) or dropping the school from the EQUIPE column (the widest team name alone is
   186 px, so the column could be about 224 and the tower about 1056). Which, if any?
2. The strip pages 5 cars in equal cells, 12 pages (84 s for the field). Content-sized cells
   fit 7 per page (9 pages, 63 s), but then the cells change width from page to page and a
   four-car last page stretched its cells across the bar, which equal cells fix. Six equal
   cells need 1266 px of car area and there are 1236 at most (1165 under QUADRICULADA). Keep
   5 and the calm bar, or go back to 7 content-sized cells for density?
3. The clock's caption "TEMPO RESTANTE" still breaks into two lines beside the 72 px time: at
   20 px tracked .06em it is 193 px and the column beside the time is 141 px. The lead asked
   for it on the right end of the session ribbon at 22 px, white, leaving only "34 VOLTAS"
   beside the time. Measured, the session name at 22 px (700, .04em) is 287.5 px and the
   caption at 22 px (500, .06em) 210.5 px: 514 px with a 16 px gap, against 408 px of ribbon
   content on a 440 px plate (untracked they are still 269 + 192 = 461; with the caption at
   the 20 px minimum, 496). The ribbon would need a 548 px clock (532 with the caption at
   20 px), and the compact tower shares the clock's right edge, so its name column would gain
   108 px and the left column would end at x 644. The body is therefore unchanged until the
   width is decided: widen the clock and the tower to 548, or keep 440 and the two-line
   caption?
4. Long flag words in the strip ("PRÉ-LARGADA", "QUADRICULADA") widen the clock block by 27
   and 71 px and the hairlines shift at those two flag changes (the first and the last of the
   race); every page still fits. Acceptable, or should the strip abbreviate those two words?
5. Should the overall fastest lap be marked in the detailed tower (a green MELHOR cell for
   car 31)? Left out to keep green for the leader only.
6. The strip has no session name (see "The lower strip"). Restoring it under the 28 px rule
   means a 28 px line and a time of about 34 px instead of 44; restoring the brief's 20 px
   line means an exception to the shared rule. Wanted at all?
7. The sponsor bug's angled edge is the top-left corner cut, parallel to every ribbon cap, so
   the bug repeats the stripe instead of mirroring it. The brief said "bottom-left corner cut",
   which is the mirror image; one line (`.sponsor-bug .plate { clip-path }`) restores it. Keep
   the parallel cut?
