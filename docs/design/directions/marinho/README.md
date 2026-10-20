# marinho — the scoreboard on navy, every cell a chip

The scoreboard's structure on brand navy, with its one idea pushed further: the car number is
a chip today, so here the position and the laps are chips too, and a row reads as three
badges (white, sky blue, green) on a navy pill. The most colourful of the three, and the one
that carries the brand navy as a surface.

## A ideia

Navy pills (`rgb(0 59 113 / 0.90)`, 10 px corners, 2 px gaps so the pills almost touch, like
a stack of badges), white names in Saira, and three chips per row: position on white, car on
the scoreboard's sky blue (`#3DB5F5`, kept as a nod to today's look), laps on green, all
with navy text. The leader's position chip turns brand green. The head pill carries a sky-blue
dot before "POSIÇÕES", and the clock's laps are a green chip too. The column sits top-right as
on the scoreboard, the bug top-left.

Pages: `race-clock`, `positions-compact`, `positions-detailed`, `lower-strip`, `lower-third`,
`sponsor-bug`, the combos `combo-tower` (clock + compact tower + bug) and `combo-strip`
(strip + lower third), the sheets `sheet-flags` and `sheet-status`, and `motion-demo`
(`motion.md`). Every `.html` here is generated: `generatePages.mjs` writes them from
`../../sample-data.json` through the templates the three slate directions share
(`../../tools/slateTemplates.mjs`): `node docs/design/directions/marinho/generatePages.mjs`
from the repo root. `styles.css` imports the shared structure (`../../tools/slate-base.css`)
and adds the chip rules; `tokens.css` is where the direction lives.

## Legibility at 720p on a phone

Sizes at 1080p, with the 720p equivalent in brackets: clock time 56 px (37); lower-third name
42 px (28); strip time 44 px (29); strip positions, chips and school names 28 px (19); tower
rows 26 px (17) for positions, car chips, names and laps, in Saira 600–700; session name
28 px (19) in mixed case (Saira's caps are wide); flag word 24 px (16) bold; detailed tower's
gaps and times 24 px (16); captions, school names in the detailed tower and the sponsor line
20 px (13), the floor. Chips give every number its own high-contrast field, so the digits read
on a phone whatever the footage; the cost is width: Saira is wide and the column is 480 px so
no page-1 name truncates. Pills are 34 px (23 at 720p) with 2 px gaps.

## Safe areas

Everything on air is inside the 90% title-safe box (x 96..1824, y 54..1026), checked by
`node docs/design/tools/checkLayout.mjs marinho`:

| Graphic | Box (1080p) |
| --- | --- |
| Race clock | x 1344..1824, y 54..250 (480 × 196: 68 head, 88 body, 40 flag band) |
| Compact tower | x 1344..1824, y 258..1006 (head pill 28, then 20 pills of 34 with 2 px gaps) |
| Detailed tower | x 704..1824, y 258..1008 (1120 wide, 19 pills of 36) |
| Lower strip | x 96..1824, y 954..1026 (72 tall) |
| Lower third | x 96.., bottom at y 940 (name pill 64, role pill 40), above the strip's room |
| Sponsor bug | x 96..428, y 54..156 |

## Contrast

Computed with `node docs/design/tools/contrastRatio.mjs`; translucent navy composited over
`#E8EEF5` (bright sky, the worst backdrop):

| Text | On | Ratio | Where |
| --- | --- | --- | --- |
| `#FFFFFF` | navy at 90% over sky | 8.76:1 | names, times, the strip's school chips |
| `#B9C8DB` muted | navy at 90% over sky | 5.15:1 | captions, school names, page cell |
| `#B9C8DB` muted | head navy at 96% over sky | 7.48:1 | tower heads |
| `#003B71` | `#FFFFFF` position chip | 11.27:1 | positions |
| `#003B71` | `#3DB5F5` car chip | 4.90:1 | car numbers |
| `#003B71` | `#4ADE80` laps chip | 6.47:1 | laps, the clock's laps |
| `#FFFFFF` | `#009739` leader chip | 3.83:1 | the leader's position, 26 px bold: large text only |
| white at 55% | navy at 90% over sky | 3.96:1 | retired rows, 26 px bold: large text only, by design dimmed |
| `#FFFFFF` | flag pre `#5B6472` | 5.98:1 | PRÉ-LARGADA |
| `#FFFFFF` | flag green `#15803D` | 5.02:1 | VERDE |
| `#111111` | flag yellow `#FFD600` | 13.37:1 | AMARELA |
| `#FFFFFF` | flag red `#DC2626` | 4.83:1 | VERMELHA |
| `#F5F5F5` | `#111111` word plate | 17.32:1 | QUADRICULADA over the squares |
| `#FFFFFF` | flag finished `#1F2937` | 14.68:1 | ENCERRADA |

## Tower rows

- **Compact: 20 rows** (positions 1–20). The clock card ends at y 250; the tower starts at 258,
  its head pill is 28 px and each row pill 34 px with 2 px gaps, so 20 rows end at 1006. A
  21st would end at 1042; 32 px pills would give 21 rows at 1006 + 32 = 1038, still over.
- **Detailed: 19 rows** (positions 1–19) of 36 px, 1120 px wide: POS 44, cue 10, chip 44, team
  (name + school 20 px), VOLTAS 88, DIF. 116, INTERV. 110, ÚLT. VOLTA 132, MELHOR 108,
  ABAST. 88, status 24. Saira's digits are wide, so the numeric columns are the widest of the
  three directions.
- The towers page through the 60-car field (1–20, 21–40, 41–60) on the strip's hold; page 1
  is what the mock-ups show.

## The lower strip

Pages, not scrolling: scrolled text smears under stream compression and cannot be read on a
phone while it moves. Each car is a pill with its three chips (white position, sky-blue car,
the school name on a translucent white chip), as wide as its name; the pills share the bar.
The generator sets **5 cars per page** (12 pages, 72 s for the field): the widest page of the
field needs 1284 px of the 1313 available, and 6 per page would need 1550 (measured in
Chromium; Saira is wide). The clock block never moves; the page cell reads "1/12".

## Extending to the §9 catalogue

Everything is a navy pill or card; a number is always on a chip:

- **Team card**: a wide card with the clock's head (logo, team name), the car chip, school and
  city in Barlow, a photo cell with the chip corners.
- **Battle card**: two pills facing, the gap on a white chip between them.
- **Podium**: three cards rising, 1º 2º 3º on white chips, the winner's green.
- **Bracket**: pills on thin navy lines, winners' chips green.
- **Standings table**: the detailed tower's rows with PONTOS on green chips.
- **Intermission board**: a large centred navy card with the logo.
- **Sponsor roll**: the bug's card cycling names.
- **Countdown**: the clock card without the flag band, the time on a white chip.
- **Penalty notice**: a card with a red flag-set band and the car chip.
- **Fastest lap**: a card with the lap time on a green chip and "MELHOR VOLTA".
- **QR card**: a white card so the code scans; the chips' white as a surface.

## Type

Saira 600–800 for rows, numbers, times and titles (tabular figures, squared shapes that suit
the chips); Barlow 500–700 for captions, roles, school names and the sponsor line. Both SIL
OFL, self-hosted (`../../fonts`). Urzeit is not depended on; once the licensed file arrives it
could set the session word in the clock head and the bug's "ENDURO", nothing else.

## Open questions for João

1. The column is 480 px wide (Saira), 60 px more than the other two. Accept it, or switch the
   names to Barlow Condensed and keep Saira for the chips (420 px)?
2. Keep the scoreboard's sky blue `#3DB5F5` for the car chip, or use brand blue `#386DB4`
   with white numbers (5.23:1) so every colour on air is a brand colour?
3. The strip holds 5 cars per page with whole school names; two-line cells would hold 9–10.
4. Chips on every cell of the detailed tower too (today only position, car and laps), or keep
   the timing columns as plain text so the row stays calm?
