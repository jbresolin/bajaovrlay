# grafite — the scoreboard in one colour and one accent

The scoreboard's structure (slate pills, a car chip, a logo-and-title head) with the colour
taken out: graphite pills, white type, and one accent, brand green, on the car chip and under
the clock's head. The quietest of the three, and the one with no yellow anywhere.

## A ideia

Rows as separate pills, like the scoreboard, but graphite (`rgb(14 18 32 / 0.88)`, 6 px
corners, 4 px gaps) with a soft shadow, white positions and names in Barlow Condensed, laps in
white, and the car number on a brand-green chip: the one coloured thing in every row, so the
eye finds cars by their chip. The leader's position is a white chip. The column sits on the
left (broadcast convention), the bug top-right; one token each if João wants them swapped.

Pages: `race-clock`, `positions-compact`, `positions-detailed`, `lower-strip`, `lower-third`,
`sponsor-bug`, the combos `combo-tower` (clock + compact tower + bug) and `combo-strip`
(strip + lower third), the sheets `sheet-flags` and `sheet-status`, and `motion-demo`
(`motion.md`). Every `.html` here is generated: `generatePages.mjs` writes them from
`../../sample-data.json` through the templates the three slate directions share
(`../../tools/slateTemplates.mjs`): `node docs/design/directions/grafite/generatePages.mjs`
from the repo root. `styles.css` imports the shared structure (`../../tools/slate-base.css`)
and adds this direction's two rules; `tokens.css` is where the direction lives.

## Legibility at 720p on a phone

Sizes at 1080p, with the 720p equivalent in brackets: clock time 56 px (37); lower-third name
44 px (29); strip time 44 px (29); strip positions, chips and school names 28 px (19); tower
rows 26 px (17) for positions, car chips, names and laps, in Barlow Condensed 600–700; session
name 30 px (20); flag word 24 px (16) bold; detailed tower's gaps and times 24 px (16);
captions, school names in the detailed tower and the sponsor line 20 px (13), the floor.
Mixed-case names in a condensed face read at 17 px on a phone because the counters stay
open at 600 weight. Pills are 32 px (21 at 720p) with 4 px gaps.

## Safe areas

Everything on air is inside the 90% title-safe box (x 96..1824, y 54..1026), checked by
`node docs/design/tools/checkLayout.mjs grafite`:

| Graphic | Box (1080p) |
| --- | --- |
| Race clock | x 96..516, y 54..230 (420 × 176: 60 head, 84 body, 32 flag band) |
| Compact tower | x 96..516, y 238..1022 (head pill 28, then 21 pills of 32 with 4 px gaps) |
| Detailed tower | x 96..1156, y 238..1026 (1060 wide, 19 pills of 36) |
| Lower strip | x 96..1824, y 954..1026 (72 tall) |
| Lower third | x 96.., bottom at y 940 (name pill 64, role pill 40), above the strip's room |
| Sponsor bug | x 1492..1824, y 54..158 |

## Contrast

Computed with `node docs/design/tools/contrastRatio.mjs`; translucent graphite composited over
`#E8EEF5` (bright sky, the worst backdrop):

| Text | On | Ratio | Where |
| --- | --- | --- | --- |
| `#FFFFFF` | graphite at 88% over sky | 13.84:1 | positions, names, laps, times |
| `#A9B2C3` muted | graphite at 88% over sky | 6.49:1 | captions, school names, page cell |
| `#A9B2C3` muted | head graphite at 97% over sky | 8.24:1 | tower heads |
| `#FFFFFF` | `#009739` car chip | 3.83:1 | car numbers, 26 px bold: large text only |
| `#0E1220` | `#FFFFFF` leader chip | 18.65:1 | the leader's position |
| white at 50% | graphite at 88% over sky | 4.65:1 | retired rows |
| `#FFFFFF` | flag pre `#5B6472` | 5.98:1 | PRÉ-LARGADA |
| `#FFFFFF` | flag green `#15803D` | 5.02:1 | VERDE |
| `#111111` | flag yellow `#FFD600` | 13.37:1 | AMARELA |
| `#FFFFFF` | flag red `#DC2626` | 4.83:1 | VERMELHA |
| `#F5F5F5` | `#111111` word plate | 17.32:1 | QUADRICULADA over the squares |
| `#FFFFFF` | flag finished `#1F2937` | 14.68:1 | ENCERRADA |

The car chip is the one pair below 4.5:1; the number on it is 26 px at weight 700, which
WCAG counts as large text (3:1). A deeper green would pass normal text but would no longer be
the brand green; see open question 2.

## Tower rows

- **Compact: 21 rows** (positions 1–21). The clock card ends at y 230; the tower starts at 238,
  its head pill is 28 px and each row pill 32 px with 4 px gaps, so 21 rows end at 1022. A 22nd
  would end at 1058.
- **Detailed: 19 rows** (positions 1–19) of 36 px, 1060 px wide: POS 36, cue 14, chip 44, team
  (name + school 20 px), VOLTAS 84, DIF. 112, INTERV. 108, ÚLT. VOLTA 128, MELHOR 104,
  ABAST. 84, status 28.
- The towers page through the 60-car field (1–21, 22–42, 43–60) on the strip's hold; page 1
  is what the mock-ups show.

## The lower strip

Pages, not scrolling: scrolled text smears under stream compression and cannot be read on a
phone while it moves. Each car is a pill (position, green chip, school name 28 px), as wide as
its name; the pills share the bar. The generator sets **6 cars per page** (10 pages, 70 s for
the field): the widest page of the field needs 1196 px of the 1358 available, and 7 per page
would need 1382 (measured in Chromium). The clock block never moves; the page cell reads "1/10".

## Extending to the §9 catalogue

Everything is a graphite pill or card; green marks a car, white marks the first:

- **Team card**: a wide card with the clock's head (logo, team name), the green chip, school
  and city in Barlow, a photo cell.
- **Battle card**: two pills facing, the gap in white between them.
- **Podium**: three cards rising, the winner's position on a white chip, the others plain.
- **Bracket**: pills on thin graphite lines.
- **Standings table**: the detailed tower's rows with a PONTOS column.
- **Intermission board**: a large centred card with the green rule under its head.
- **Sponsor roll**: the bug's card cycling names.
- **Countdown**: the clock card without the flag band.
- **Penalty notice**: a card with a red flag-set band and the green chip.
- **Fastest lap**: a card with the lap time at 44 px and "MELHOR VOLTA" in a white chip.
- **QR card**: a light card so the code scans.

## Type

Barlow Condensed 600–800 for rows, numbers, times and titles (tabular figures); Barlow
500–700 for captions, roles, school names and the sponsor line. Both SIL OFL, self-hosted
(`../../fonts`). Urzeit is not depended on; once the licensed file arrives it could set the
session word in the clock head and the bug's "ENDURO", nothing else.

## Open questions for João

1. Column on the left (as here) or on the right as the scoreboard has it? One token.
2. The green car chip is 3.83:1 with white numbers (large text). Keep brand green, or deepen
   it to `#15803D` (the flag green, 5.02:1) at the cost of two greens on air?
3. The strip holds 6 cars per page with whole school names; two-line cells would hold 10–11.
4. Is one accent enough, or should laps get the scoreboard's green text back?
