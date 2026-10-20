# vidro — floating glass

## A ideia

Smoked navy glass panels float over the footage: a flat tint of brand navy at 86%, a
hairline edge, 12px corners and Inter with a lot of air. The picture is still there through
the panel (14% of it), but nothing behind the panel is blurred. The brand colours appear
only as small lights (the green live dot, the leader's 3px edge and green position pill, the
lower-third bar, the glows after a position change), never as fields; brand yellow is not
used anywhere on air, so nothing can be mistaken for a yellow flag.

The first draft was frosted: the same glass at 76% with `backdrop-filter: blur(14px)
saturate(120%)`. That was not shippable. The program renderer is a transparent browser
source that OBS composites over the video (`docs/00-concept.md` §6), so behind the page
there are only transparent pixels and the blur has nothing to blur: the mock-up screenshots
would frost the footage and the stream would not. Blurring the footage would need the
renderer to receive the program video, which it does not. The tint went from 0.76 to 0.86 so
the panel still reads over busy footage without the blur's softening (white on it over
bright sky is 11.80:1, muted text 6.68:1), and `--panel-blur` stays in `tokens.css` as
`none`, with the reason beside it.

Pages: `race-clock`, `positions-compact`, `positions-detailed`, `lower-strip`,
`lower-third`, `sponsor-bug`, the combos `combo-tower` (clock + compact tower + bug) and
`combo-strip` (strip + lower third), the sheets `sheet-flags` and `sheet-status`, and
`motion-demo` (see `motion.md`). Every `.html` here is generated from `sample-data.json` by
`generatePages.mjs` in this folder: `node docs/design/directions/vidro/generatePages.mjs`
from the repo root rewrites them all, so no row is typed by hand. The four flag words the
sample does not carry (PRÉ-LARGADA, VERMELHA, QUADRICULADA, ENCERRADA) are copied from the
race clock's pt-BR catalogue (`packages/graphics/race-clock/src/ptBR.ts`).

## Legibility at 720p on a phone

At 720p everything is two thirds of the sizes below; on a phone, smaller again.

- Compact tower: positions, car numbers, names and laps are all 26px (17px at 720p), the
  car number in a 48 × 28 pill, the leader's position in a 40 × 28 green pill; rows 32px
  (21px). Checked on a 1280x720 downscale of `combo-tower` over frame 1: every name reads,
  the "P" pit glyph is still a P, the dimmed retired row still reads as a row, and P1 is the
  one green mark in the column.
- Lower strip: everything 28px (19px at 720p), the flag pill's word and the page counter
  included; `checkLayout` reports 28px as the strip's smallest text. The session name is
  not in the strip: at the brief's 20px it would be the one string under the floor, and the
  clock card carries it whenever the tower is on air (open question 3).
- Race clock: 72px time; captions 20–22px. The 20px caption is the smallest text on air
  (13px at 720p) and is a label, never a number.
- Nothing on air is below 20px. Numbers always use tabular figures so nothing jitters.
- Glass is the legibility risk of this direction: the panel is translucent, so the backdrop
  matters. The alpha (0.86) was chosen with the contrast tool over bright sky, the worst
  backdrop; over dirt, grass or crowds the panel is darker and every ratio rises. There is
  no blur to soften a busy backdrop, so the tint does all the work.

## Safe areas

Everything on air sits inside x 96..1824, y 54..1026 (`checkLayout.mjs` passes):

| Graphic | Box |
| --- | --- |
| Race clock | 96..584 × 54..254 (488 × 200) |
| Compact tower | 96..584 × 266..1010 (header 40 + 22 rows × 32) |
| Detailed tower | 96..1336 × 266..1026 (header 40 + 18 rows × 40) |
| Lower strip | 96..1824 × 950..1026 (76 tall, radius 14) |
| Lower third | 96..584 × 786..940 (min-width 488, max-width 760; 488 so it shares the column of the clock and the tower; bottom at 940, 10px above the strip) |
| Sponsor bug | 1438..1824 × 54..188 (386 × 134, light capsule, logo 144 wide) |

The tower is one left column under the clock (same 488 width, 12px apart). The bug is a
corner. The strip and lower third never overlap: the strip's room is y 950..1026. That room
covers the compact tower's rows 21 and 22 (y 946..1010), so when the strip and the tower
share the air the operator takes the tower with 20 rows; `motion-demo` shows it that way.

## Contrast

Computed with `tools/contrastRatio.mjs`. Translucent panels are composited over `#E8EEF5`
(bright sky). Muted and retired text is white at an opacity, so its colour was composited
first over whatever is directly behind it (the glass on sky, `#203952`; a number pill; a
glow; the light capsule) and the flat colour handed to the tool, so every ratio below is
what the tool prints for the two hex colours in its row.

| Text | Panel | Ratio | Where |
| --- | --- | --- | --- |
| `#FFFFFF` | glass `#001C38` @ 0.86 over sky (`#203952`) | 11.80:1 | time, names, numbers, headers on every dark panel, the lower third's name and team line |
| `#FFFFFF` | glass over near-black `#0A0A0A` (`#011932`) | 17.64:1 | the easy case, for reference |
| secondary `#E9EBEE` (white 0.90 over the glass) | glass over sky `#203952` | 9.89:1 | the lower third's role line |
| muted `#BCC4CB` (white 0.70 over the glass) | glass over sky `#203952` | 6.68:1 | captions, session name, laps, column headers, school names, the strip's page counter |
| retired `#A6B0BA` (white 0.60 over the glass) | glass over sky `#203952` | 5.36:1 | every text of a retired row, the school name included |
| `#FFFFFF` | number pill `#374D64` (white 0.10 on glass over sky) | 8.71:1 | car numbers in the tower and strip pills |
| retired `#AFB8C1` (white 0.60 over the pill) | number pill `#374D64` | 4.33:1 | a retired car's number in its pill: AA for large text only, which the 26px/600 number is (24px and up) |
| `#FFFFFF` | leader pill `#009739` (brand green) | 3.83:1 | the leader's position number, 26px/700 in the towers and 28px/700 in the strip: large text only (bold 19px and up), the one brand-green field on air |
| `#FFFFFF` | moved-up glow `#155A4A` (green 0.35 on glass) | 8.08:1 | row text during the glow |
| muted `#B9CEC9` (white 0.70 over the glow) | moved-up glow `#155A4A` | 4.88:1 | laps and school name during the glow |
| retired `#A1BDB6` (white 0.60 over the glow) | moved-up glow `#155A4A` | 4.04:1 | a retired row's text during the glow: large text only, for 1.2 s |
| `#FFFFFF` | moved-down glow `#294B75` (blue 0.35 on glass) | 8.87:1 | row text during the glow |
| muted `#BFC9D5` (white 0.70 over the glow) | moved-down glow `#294B75` | 5.30:1 | laps and school name during the glow |
| retired `#A9B7C8` (white 0.60 over the glow) | moved-down glow `#294B75` | 4.36:1 | a retired row's text during the glow: large text only, for 1.2 s |
| `#FFFFFF` | flag pre `#5B6472` | 5.98:1 | "PRÉ-LARGADA" |
| `#FFFFFF` | flag green `#15803D` | 5.02:1 | "VERDE" |
| `#111111` | flag yellow `#FFD600` | 13.37:1 | "AMARELA" |
| `#FFFFFF` | flag red `#DC2626` | 4.83:1 | "VERMELHA" |
| `#F5F5F5` | checkered plate `#111111` | 17.32:1 | "QUADRICULADA" on the dark plate beside the checkered square |
| `#FFFFFF` | flag finished `#1F2937` | 14.68:1 | "ENCERRADA" |
| navy `#003B71` | light capsule white @ 0.94 over sky (`#FEFEFE`) | 11.16:1 | sponsor name |
| navy `#003B71` | light capsule over near-black (`#F0F0F0`) | 9.91:1 | sponsor name, dark footage |
| navy 0.80 `#33628D` (over the capsule) | light capsule over sky `#FEFEFE` | 6.36:1 | "Apresentado por" |
| navy 0.80 `#305F8A` (over the capsule) | light capsule over near-black `#F0F0F0` | 5.88:1 | "Apresentado por", dark footage |

The flag set is the palette shared by the three directions (so João compares looks, not
flag colours): every pill word is white except on yellow, and every pair is AA for normal
text, so no flag word leans on the large-text exception.

Informational, and the reason the brand colours are lights and not text: brand blue on the
glass is 2.26:1 and brand green 3.08:1. Brand blue appears only in the moved-down glow;
brand green is never text, which is why the leader's position is white on a green pill and
not a green number. The pairs below 4.5:1 that can occur on air are all large text: the
leader's position on its pill (3.83:1, 26px/700 and 28px/700, for the whole session), a
retired car's number on its pill (4.33:1, 26px/600, for as long as the car is listed) and a
retired row's muted text during a glow (4.04:1 green, 4.36:1 blue) for 1.2 s when a retired
car changes position.

## Tower rows

The clock card is 200px tall (its four rows: session, "TEMPO RESTANTE", the 72px time, laps
+ flag pill). The 72px time is 268px wide, so "34 VOLTAS" could sit beside it inside the
488px card; it sits under it on purpose, paired with the flag pill in the foot row as the
brief lists them, so the card reads top to bottom in one order. The cost is the empty right
half of the card beside the time (268px of time in a 448px content box). A three-row card
(laps beside the time) would be about 160px tall and give the tower a 23rd row: open
question 7. The tower starts 12px below the clock, at y 266, leaving 760px to the
title-safe edge.

- **Compact: 22 rows** (positions 1–22). Header 40 + 22 × 32 = 744 (bottom at 1010); a
  23rd row would end at 1042. The rows are 32px, the contract's minimum and on the 4px grid;
  at the 34px the brief suggested only 21 fit, and 22 was the target. Positions 26px/700 in
  a 40px column ("22" is 34px wide), car numbers 26px/600 in a 48 × 28 pill, names 26px/600,
  laps 26px/500 muted in a 36px column ("34" is 34px wide), a 28px status column, 1px
  dividers at 8% white. The leader has a 3px green edge and its position number sits in a
  40 × 28 brand-green pill (white 26px/700, 3.83:1, large text only); the row itself has no
  fill. Both marks belong to the first slot, not to a car. The brief's starting values had
  the car number and the laps at 24px; the contract floor for the compact tower's numbers
  is 26px.
- The tower is 488px wide, not 360: at 26px Inter 600 "Coruja Racing" alone is 176px and
  the fixed cells take 208px (40 position + 48 pill + 36 laps + 28 status + 32 of gaps + 24
  of padding), so at 360 the name column would be 152px and most names would be cut. At 488
  the name column is 280px and no team name in the 60-car field truncates: the widest,
  "Lobo-Guará Off-Road", is 271px, then "Jaguatirica Off-Road" 261 and "Quero-Quero Racing"
  257. P13 ("Lobo-Guará Off-Road") is the tightest row, with 19px between the name and the
  laps; every other row has 44px or more. (At 480 that row had 11px, which is why the
  column is 488 and not 480.) The clock card shares the 488 so the two make one column.
- **Detailed: 18 rows** (positions 1–18). Header 40 + 18 × 40 = 760, ending exactly at 1026.
  Columns: POS 48, Nº 48, EQUIPE 308, VOLTAS 88, DIF. 136, INTERV. 112, ÚLT. VOLTA 140,
  MELHOR 104, ABAST. 88, status 28, with 12px gaps and 16px padding, 1240 in all. Each
  numeric column is its widest content plus slack ("POS" is 45px, "VOLTAS" 82, "INTERV." 84,
  "ÚLT. VOLTA" 121, "MELHOR" 91, "ABAST." 79; at 24px/600 "+22 voltas" is 124, "+412,7 s"
  105, "6:38,4" 76), and the slack is largest where two wide right-aligned headers meet
  (ÚLT. VOLTA 19px, MELHOR 13px), so the gaps between INTERV., ÚLT. VOLTA, MELHOR and ABAST.
  are 31, 25 and 21px, three to four times the 7px word space inside "ÚLT. VOLTA", and the
  headers never read as one run-on line. The widest page-1 team + school, "Lobo-Guará
  Off-Road UFU", is 304px, so nothing truncates in 308. Position and car number 26px like
  the compact tower, the leader's position in the same 40 × 28 green pill at the right of
  the 48px POS column; the other numbers 24px with tabular figures, VOLTAS at 700 and the
  rest at 600 (see "Type"): DIF. and ÚLT. VOLTA in white, INTERV., MELHOR and ABAST. muted,
  so the eye lands on the numbers that matter. The leader's DIF. and INTERV. show an em
  dash, so the two columns have an anchor on row 1 instead of two blank cells that read as
  missing data.
- The detailed tower is 1240px wide, not the brief's "about 920": ten columns at the 20px
  header floor need 1100px of columns plus 108 of gaps and 32 of padding, and 920 would
  leave 780px for the ten. Narrower costs a column: dropping MELHOR from the on-air detailed
  tower (best lap stays in the data) gives about 1130px; dropping ABAST. too, about 1030px.
  Open question 9.

## The lower strip

One glass bar, 1728 × 76, radius 14, bottom at 1026. Left: the clock capsule with the 40px
time and the flag pill, its word at 28px (the session name is not in the strip; see
"Legibility"). Then four cells "position · car number in a pill · short team name",
separated by hairlines, equal in width, with the content centred in the cell. Right: a page
counter ("1/15", 28px, in an 88px column).

- **The capsule is as wide as its content and follows the flag word.** 16 of padding + 149
  (the time) + 12 + the pill + 12 to the first cell's hairline: 334px with VERDE (the pill is
  145), 383 with AMARELA (+49), 401 with VERMELHA (+67), 418 with ENCERRADA (+85), 450 with
  PRÉ-LARGADA (+116), 479 with QUADRICULADA (+145; "QUADRICULADA" at 28px/700 is 242, plus
  the 24px checkered square and the padding). The cells share whatever is left, so a longer
  word pushes the first hairline right by those amounts and narrows every cell by a quarter
  of it; nothing is ever cut (next bullet). The first draft fixed the capsule at 488 for the
  widest word and left 166px of empty glass in the green state, the state that is on air
  most of the race. The six states are on `sheet-flags`.
- The counter is 88px because with tabular figures "1/15" at 28px/500 is 64px and "15/15"
  is 82px; 80px would have let pages 10 to 15 touch the strip's right edge.
- The "short team name" is the `schoolName` of the canonical shape (its short form: "UFPR",
  "EESC-USP"); the full team name is in the towers. The leader's position sits in the same
  brand-green pill as the towers, 40 × 36 to match the strip's car-number pills.
- **4 cars per page, 15 pages, 6 s per page, 90 s for the whole field.** At the 28px floor,
  a cell holding the position, the number pill and the widest school name needs 285px:
  24 of padding + 40 position + 8 + 56 pill + 8 + 2 + 147 ("CEFET-MG" in Inter 600;
  "EESC-USP" is 143, "UNIOESTE" 142). With VERDE on the pill 1306px remain after the
  capsule and the counter: four cells of 326 (41px of room each), and five would be 261,
  24px short of "CEFET-MG". Five does not become possible by trimming the cell either: with
  the pill at 48 and the gaps at 6 the content still needs 273. With QUADRICULADA, the
  widest word, the four cells are 290 and the widest content still fits with 5px to spare,
  so no school name truncates in any flag state. A counter replaced the page dots because
  15 dots would take 170px, more than half a cell. A cell holds from 5px ("CEFET-MG" at
  QUADRICULADA) to about 130–150px (a three-letter school at VERDE: "UFG" leaves 131,
  "FEI" 148) more than its content, so the content is centred and the room is split evenly
  instead of piling up at the right.
  Open question 2 lists the way to the brief's nine per page.
- **Paging, not scrolling.** A crawl smears under stream compression (YouTube's encoder
  spends bits on the moving footage, and moving text becomes a grey streak) and is
  unreadable at 720p on a phone. A still page for 6 s reads at a glance; the crossfade
  (300 ms, 8px slide) tells the viewer the page changed without moving any glyph.

## Extending to the §9 catalogue

Every item is the same glass card with the same type scale; brand colours stay lights.

- Team card: a wide card, photo with 12px rounded corners on the left, name 46px, school
  and car number pill, laps and best lap as caption + number pairs.
- Battle card: two cards side by side, a small glass gap pill between them ("+1,7 s").
- Podium: three cards rising from the strip's room, 1st taller and entered last; a green
  edge and the green position pill on 1st only.
- Bracket: cards on thin hairlines, winners with the green edge.
- Standings table: rows exactly like the detailed tower (POS, Nº, EQUIPE + school, points).
- Intermission board: one large centred card (not full screen, so the footage stays), the
  event name as the title, the next session and its time.
- Sponsor roll: light cards (the bug's style) cycling with the strip's crossfade.
- Countdown: the clock card without the flag pill, the laps line replaced by the caption.
- Penalty notice: a card with a red flag-set pill ("VERMELHA" style) and the car number pill.
- Fastest lap: a card with the time 72px and a green pill "MELHOR VOLTA" built like the flag
  pill (white word on the flag green, 5.02:1), car number pill and team.
- QR card: a light card (the bug's style), so the code is black on near-white and scans;
  the caption in navy.

## Type

Inter only, self-hosted (`fonts/inter`), with `font-variant-numeric: tabular-nums` on every
time, gap and lap. Weights, as the CSS sets them:

- 700 for the times (−0.01em on the 72px and 40px clocks), the positions in the towers and
  the strip (the leader's included), the laps count (VOLTAS) in the detailed tower, the flag
  words and the lower-third name.
- 600 for names (team, school in the strip, sponsor), the car numbers in their pills, and
  the detailed tower's gaps, intervals, lap times and fuel stops. These nine numeric
  columns are 600 and not the brief's 700 because nine bold columns read heavy; 600 keeps
  the tabular figures crisp at 720p, and VOLTAS alone at 700 is where the eye lands (open
  question 10).
- 500 for captions (uppercase, +0.06em, 20–22px: session name, "TEMPO RESTANTE", the laps
  line, the tower headers, the column headers, "Apresentado por"), the compact tower's laps,
  the detailed tower's school names, the strip's page counter, and the lower third's role
  line (24px, at 0.90 white rather than the 0.70 of a caption: the role is the second thing
  read on a lower third and was too quiet at 400/0.70).
- 400 only for the lower third's team line, which is prose, not data.

Urzeit is not depended on; if it becomes available it could set the event name on the
intermission board, the podium and the team card titles as a display accent, never a
number or a name.

## Open questions for João

1. Tower width: 488px (no team name of the field truncates, and the tightest row keeps 19px
   between name and laps) instead of the brief's 360. Keep it, or show the school name in
   the compact tower and go back to a narrower column?
2. Strip, three ways: (a) this page, 4 cars per page at the 28px floor with the school name,
   90 s for the field; (b) the brief's 9 per page, with position + car-number pill only
   (128px a cell: 24 + 40 + 8 + 56; nine are 1152, which fits in every flag state: 1161 remain
   even at QUADRICULADA), at the cost of the school name, which would then live in
   the towers only; (c) 5 per page with 24px names, against the contract. Which?
3. Strip session name: the brief's capsule spec has it at 20px, under the strip's 28px
   floor, so it was dropped from the strip (the clock card carries it, and the strip's pill
   word went to 28px for the same reason). Want it back at 20px as a stated exception, or
   at 28px (295px wide: beside the pill the capsule grows by that much and the strip holds
   three cells, not four; stacked over the pill the capsule stays narrow but the two lines
   need 70 of the bar's 76px)?
4. Strip capsule on a flag change: the capsule follows the flag word, so when VERDE becomes
   AMARELA or VERMELHA the cells shift left by 49 or 67px in one cut (the pill's colours
   crossfade, its width does not). A minimum capsule width at the VERMELHA state (401px)
   would hold the cells still through the three racing flags at the cost of 67px of empty
   glass in the green state. Follow the word, or hold the cells?
5. Sponsor bug: 386 × 134 with the logo at 144px (the brief says about 160; at 160 the bug
   would be 402 × 146, still inside title-safe with its right edge at 1824), and the sponsor
   line stacked in two lines ("Apresentado por" over the name) instead of the brief's single
   "Apresentado por · Metalúrgica Serrana". Keep 144 or go to 160? One line or two? And
   should the sample's `eventLabel` ("ENDURO") appear on it?
6. Brand blue: the brief contradicts itself. Its LOOK paragraph gives brand blue to "the
   team line in the lower third"; its LAYOUT gives that line "a green dot". The page uses
   the green dot, and brand blue appears only in the moved-down glow (as text on the glass
   it is 2.26:1, so it fails AA there and has no static home on the dark glass). If blue is
   wanted on the lower third it can go on the dot only, never on the text. Acceptable that
   it has no static home?
7. Clock card: laps beside the 72px time (a three-row card of about 160px) would give the
   compact tower a 23rd row. Worth the change in the card's reading order?
8. Should the strip cells carry the status icons too (they would cost 28px per cell)?
9. Detailed tower width (1240 against the brief's about 920): keep all ten columns, drop
   MELHOR on air (about 1130px), or drop MELHOR and ABAST. (about 1030px)?
10. Detailed tower numbers at 600 instead of the brief's 700 (VOLTAS alone at 700): nine
    bold columns read heavy and 600 keeps the tabular figures crisp at 720p. Confirm, or
    go to 700 everywhere (the columns fit either: "+22 voltas" is 126px at 700, in 136)?
11. Leader pill: the green position pill is the one brand-green field on air (white on it
    is 3.83:1, large text only). It marks P1 in the compact tower, the detailed tower and
    the strip. Keep it in all three, or towers only (the strip's first cell is always P1 on
    page 1 and has no leader on the other pages)?
