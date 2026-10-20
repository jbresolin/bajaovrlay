# ardosia — the scoreboard, kept

The faithful sibling of the scoreboard the stream uses today (placarbaja.juansalles.com.br):
the same slate, the same rows as separate pills, the same colour per column (yellow position,
blue car chip, green laps), the same logo-and-title head, in a clean open-licence face instead
of Urzeit and with everything the brief adds: a real race clock with the flag, status icons,
a detailed tower, a strip, a lower third and a bug that all belong to the same family.

## A ideia

The scoreboard's look, grown into a system. Every graphic is a slate pill or card
(`rgb(20 25 48 / 0.84)`, 8 px corners, 3 px gaps between pills), the car number is always a
brand-blue chip, positions are yellow text, laps are green text, and the type is Bebas Neue
in caps, as the scoreboard's rows are. The column sits top-right as today; the bug takes the
top-left corner.

What changed from the scoreboard, and why: Urzeit is "Personal Use" and distressed, so Bebas
Neue (SIL OFL, caps, tabular figures) sets numbers and names and Barlow sets the small
mixed-case text; the slate went from 78% to 84% so text passes AA over bright sky; the panel
moved inside the title-safe area (the scoreboard's 30 px margin puts it outside); rows
cascade in 30 ms apart instead of 300 ms; and yellow is used as text only. Brand yellow
(`#F4C42A`) in the position column is the one place any direction uses yellow: it is never a
field, and the flag slot always carries its word, so a column of yellow digits cannot be read
as a yellow flag. If João prefers no yellow at all, grafite is this direction without it.

Pages: `race-clock`, `positions-compact`, `positions-detailed`, `lower-strip`, `lower-third`,
`sponsor-bug`, the combos `combo-tower` (clock + compact tower + bug) and `combo-strip`
(strip + lower third), the sheets `sheet-flags` and `sheet-status`, and `motion-demo`
(`motion.md`). Every `.html` here is generated: `generatePages.mjs` writes them from
`../../sample-data.json` through the templates the three slate directions share
(`../../tools/slateTemplates.mjs`): `node docs/design/directions/ardosia/generatePages.mjs`
from the repo root. `styles.css` imports the shared structure (`../../tools/slate-base.css`)
and adds this direction's few rules; `tokens.css` is where the direction lives.

## Legibility at 720p on a phone

Sizes at 1080p, with the 720p equivalent in brackets: clock time 56 px (37); lower-third name
44 px (29); strip time 44 px (29); strip positions, chips and school names 30 px (20);
tower rows 28 px (19) for positions, car chips, names and laps; session name 34 px (23);
flag word 26 px (17); detailed tower's gaps and lap times 24 px (16) in Barlow; captions,
school names in the detailed tower and the sponsor line 20 px (13), the floor. Bebas Neue's
caps have a tall x-height-free shape that reads at 19 px on a 720p phone where a mixed-case
face at the same size would not; the trade is that names are all caps, as on the scoreboard
today. Pills are 34 px (23 at 720p) with 3 px gaps, so rows separate without lines.

## Safe areas

Everything on air is inside the 90% title-safe box (x 96..1824, y 54..1026), checked by
`node docs/design/tools/checkLayout.mjs ardosia`:

| Graphic | Box (1080p) |
| --- | --- |
| Race clock | x 1404..1824, y 54..246 (420 × 192: 64 head, 88 body, 40 flag band) |
| Compact tower | x 1404..1824, y 254..1022 (head pill 28, then 20 pills of 34 with 3 px gaps) |
| Detailed tower | x 764..1824, y 254..1023 (1060 wide, 19 pills of 36) |
| Lower strip | x 96..1824, y 954..1026 (72 tall) |
| Lower third | x 96.., bottom at y 940 (name pill 64, role pill 40), above the strip's room |
| Sponsor bug | x 96..428, y 54..172 |

## Contrast

Computed with `node docs/design/tools/contrastRatio.mjs`; translucent slate composited over
`#E8EEF5` (bright sky, the worst backdrop):

| Text | On | Ratio | Where |
| --- | --- | --- | --- |
| `#E8ECF4` text | slate at 84% over sky | 9.34:1 | names, times, captions' neighbours |
| `#AAB4C8` muted | slate at 84% over sky | 5.31:1 | captions, school names, page cell |
| `#F4C42A` yellow | slate at 84% over sky | 6.73:1 | position numbers |
| `#4ADE80` green | slate at 84% over sky | 6.35:1 | laps, clock laps |
| `#FFFFFF` | `#386DB4` car chip | 5.23:1 | car numbers |
| `#FFFFFF` | `#009739` leader chip | 3.83:1 | the leader's position, 28 px: large text only |
| `#E8ECF4` text | head slate at 94% over sky | 12.64:1 | clock head, tower head |
| text at 55% | slate at 84% over sky | 3.59:1 | retired rows, 28 px: large text only, by design dimmed |
| `#FFFFFF` | flag pre `#5B6472` | 5.98:1 | PRÉ-LARGADA |
| `#FFFFFF` | flag green `#15803D` | 5.02:1 | VERDE |
| `#111111` | flag yellow `#FFD600` | 13.37:1 | AMARELA |
| `#FFFFFF` | flag red `#DC2626` | 4.83:1 | VERMELHA |
| `#F5F5F5` | `#111111` word plate | 17.32:1 | QUADRICULADA over the squares |
| `#FFFFFF` | flag finished `#1F2937` | 14.68:1 | ENCERRADA |

## Tower rows

- **Compact: 20 rows** (positions 1–20), the brief's minimum met exactly. The clock card ends at
  y 246; the tower starts 8 px under it at 254, its head pill is 28 px and each row pill 34 px
  with 3 px gaps, so 20 rows end at 1022. A 21st pill would end at 1059. Narrower gaps or
  32 px pills would give 21 rows at the cost of the scoreboard's airy pills, which is the look
  being kept (open question 1).
- **Detailed: 19 rows** (positions 1–19) of 36 px, 1060 px wide: POS 36, cue 12, chip 44, team
  (name in caps + school in Barlow 20 px), VOLTAS 84, DIF. 112, INTERV. 108, ÚLT. VOLTA 128,
  MELHOR 104, ABAST. 84, status 28. Gaps and lap times are set in Barlow, not Bebas Neue,
  because Bebas has no lowercase and the unit must read "s", not "S".
- The field has 60 cars: the towers page through it (positions 1–20, 21–40, 41–60) on the
  same hold as the strip; page 1 is what the mock-ups show.

## The lower strip

Pages, not scrolling: scrolled text smears under stream compression and cannot be read on a
phone while it moves; a page that stays still for 7 s can. Each car is a pill (position in
yellow, car chip, school name as the short name, 30 px caps), as wide as its name; the pills
share the bar. The generator sets **6 cars per page** (10 pages, 70 s for the field), the most
for which every page of the 60-car field fits with whole names (measured in Chromium: the
widest page needs 1244 px of the 1392 available; 7 per page would need 1444). The clock
block (time 44 px and the flag pill) never moves; the page cell at the right reads "1/10".

## Extending to the §9 catalogue

Everything is a slate pill or card with a blue chip where a car is named:

- **Team card**: a wide card, the head like the clock's (logo, team in caps), the car chip,
  the school and the city in Barlow, a photo cell at the right.
- **Battle card**: two pills facing each other with the gap in a yellow-text cell between.
- **Podium**: three cards rising, 1º 2º 3º as yellow positions, the winner's chip green.
- **Bracket**: pills on thin slate lines, the winner's chip green.
- **Standings table**: the detailed tower's rows with a PONTOS column in green text.
- **Intermission board**: a large centred card, not full-screen, so the footage stays.
- **Sponsor roll**: the bug's card cycling sponsor names with the same 400 ms rise.
- **Countdown**: the clock card without the flag band, the time at 56 px.
- **Penalty notice**: a card with a red flag-set band and the car chip.
- **Fastest lap**: a card with the lap time at 44 px and a green "MELHOR VOLTA" cell.
- **QR card**: a light card (white at 96%) so the code scans; the one light surface.

## Type

Bebas Neue 400 (its only weight; caps and numbers, tabular figures) for every number, name
and title; Barlow 500–700 for captions, school names, roles and the sponsor line, and for the
detailed tower's gaps and times. Both are SIL OFL and self-hosted (`../../fonts`). Urzeit,
the scoreboard's face, is licensed to SAE but not available and cannot be bundled; once it
is, it could set the session word in the clock head ("ENDURO DE RESISTÊNCIA") and the bug's
"ENDURO", the two places the scoreboard uses it today, and nothing else.

## Open questions for João

1. 20 rows with the scoreboard's airy pills, or 21–22 rows with 32 px pills and 2 px gaps?
2. Yellow positions as on the scoreboard (text only, never a field), or white positions so no
   yellow is on air at all (grafite shows that)?
3. The strip holds 6 cars per page with whole school names; two-line cells (position and chip
   over the school) would hold 10–11. Keep the one-line pills?
4. The column is top-right as on the scoreboard. Broadcast convention is left (grafite shows
   it); either is one token.
5. The detailed tower is 1060 px wide; dropping MELHOR brings it to about 950.
