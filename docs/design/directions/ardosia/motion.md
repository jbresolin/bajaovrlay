# ardosia — motion

The existing scoreboard slides its rows in from below, one every 300 ms, and lifts them out
in reverse. This direction keeps that language and makes it broadcast-fast: every piece rises
20 px into place and fades up, and the rows cascade with a short stagger instead of a slow
one. Every duration, offset, stagger and easing is a token in `tokens.css` (`--motion-*`,
`--ease-*`), and the demos read them from there, so a demo and this page cannot drift apart:
pass 1's `motion-demo.html` (`../../tools/slateMotionDemo.js`, Web Animations API) and the
catalogue's demo pages (`motion-catalogo.html` links them; GSAP, as the product, see "The
demo pages" at the end).

| Token                              | Value                                                  | Where                                                                     |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `--motion-in`                      | 400 ms, `--ease-out` cubic-bezier(0.16, 1, 0.3, 1)     | every piece entering                                                      |
| `--motion-in-offset`               | 20 px                                                  | the rise on entry, the lift on exit                                       |
| `--motion-row-stagger`             | 30 ms per pill                                         | tower rows and strip cells, top to bottom and left to right               |
| `--motion-lead`                    | 100 ms                                                 | the tower starts this long after the clock; the bug too                   |
| `--motion-out`                     | 250 ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0)      | every piece leaving                                                       |
| `--motion-flag`                    | 300 ms, `--ease-out`                                   | the new flag band fades in over the old                                   |
| `--motion-swap`                    | 400 ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) | two pills trading places                                                  |
| `--motion-cue-hold`                | 2000 ms                                                | the ▲ / ▼ and the coloured position cell after a swap                     |
| `--motion-strip-page`              | 300 ms                                                 | a strip page turning                                                      |
| `--motion-strip-hold`              | 7000 ms                                                | a strip page stays still this long                                        |
| `--motion-notice-hold`             | 8000 ms                                                | a notice (fastest lap, penalty) leaves by itself after this               |
| `--motion-board-hold`              | 10000 ms                                               | a standings page stays still this long                                    |
| `--motion-sponsor-hold-diamante`   | 8000 ms                                                | a Diamante sponsor page (roll, corner, intermission line) stays this long |
| `--motion-sponsor-hold-ouro`       | 5000 ms                                                | an Ouro page                                                              |
| `--motion-sponsor-hold-prata`      | 3000 ms                                                | a Prata page (no Prata sponsor this year)                                 |
| `--motion-sponsor-hold-apoio`      | 3000 ms                                                | an Apoio page                                                             |
| `--motion-sponsor-hold-realizacao` | 5000 ms                                                | the organiser's page, "Realização", last in every round                   |
| `--motion-sponsor-hold`            | 5000 ms                                                | a sponsor page of a level with no hold of its own                         |
| `--motion-notice-min-hold`         | 3000 ms                                                | a notice stays at least this long before the next replaces it             |
| `--motion-page-stagger`            | 15 ms                                                  | between pieces when a page turns in place (ticker, sponsor tiles)         |
| `--motion-podium-offset`           | 40 px                                                  | the rise of a podium card when it is revealed                             |

## In and out, per graphic

- **Race clock**: the whole card rises 20 px and fades up in 400 ms; out in 250 ms, lifting
  20 px as it fades.
- **Compact and detailed towers**: the head pill first, 100 ms after the clock, then each row
  pill 30 ms after the one above it, each with its own 400 ms rise. With 20 rows the last pill
  starts at 100 + 20 × 30 = 700 ms and is in at 1.1 s. On the way out every pill leaves
  together (250 ms): a staggered exit reads as a glitch.
- **Lower strip**: the clock block, then each car pill 30 ms after the previous one, then the
  page cell; out together in 250 ms.
- **Lower third**: the name pill first, the role pill 100 ms behind it (200 ms behind the
  strip when both come up together). Out together.
- **Sponsor bug**: the card alone, 100 ms after the clock when they enter together; it never
  pulses or cycles.

## Flag change (300 ms)

The new band fades in over the old one at the bottom of the clock card (the colour and the
word crossfade together; the checkered band has no word, only the pattern), then replaces
it. Nothing moves: a flag change must read as a state, not as an animation. The band is
optional: a clock taken without it never shows one, and a clock that gains or loses the band
on air does so with the same 300 ms fade, the card growing or shrinking by the band's 40 px.

## Position change (400 ms, then 2 s)

Pills keep their position number with the slot and trade places: the two pills slide from
where they were to where they now are (FLIP, 400 ms ease-in-out), so the yellow numbers stay
in order and the cars move. The car that moved up shows a small green ▲ in the cue lane after
its position, and its position cell turns green for 2 s; the car that moved down shows a blue
▼ and a blue cell. When the swap makes a new leader, the green leader chip simply follows
slot 1. Several cars changing in one update slide together in the same 400 ms.

## More than 20 cars: the tower turns pages

The compact tower holds 20 cars and the field has 60, so the tower pages through it
(positions 1–20, 21–40, 41–60) on the strip's hold, 7 s a page. The head pill stays; the rows
of the page on air leave together (250 ms) and the next page's rows cascade in with the 30 ms
stagger, so the turn reads as "the list changed", never as a scroll. A car that crosses a
page boundary (20th to 21st) is simply on the other page at the next turn. The detailed
tower pages the same way. The product may also hold the tower on page 1 (the top 20) and
leave the whole field to the strip; that is an operator's choice, not a different motion.

## Position change while the tower is on air

A new positions snapshot moves rows, never numbers: the position cells belong to the slots,
the pills to the cars. Every pill whose slot changed slides from its old place to its new one
in the same 400 ms (FLIP), so two cars trading places cross each other and a car gaining
three places slides past three others at once. The car that moved up shows the green ▲ and
a green position cell for 2 s, the car that moved down the blue ▼ and a blue cell; a new
leader simply takes the green leader chip of slot 1. A car entering the page from the next
one rises in from below its slot (the in motion); a car leaving the page lifts out. Laps and
status icons change in place with no motion: a number that changes is read, not watched.

## The lower strip

Pages of 6 cars (README "The lower strip"), each held 7 s. On a page change the old pills lift
away and the new pills rise in, 300 ms each, cascading 15 ms apart (half the row stagger), so
the bar never goes empty and never scrolls: scrolled text smears under stream compression and
cannot be read on a phone while it moves; a still page can.

## The catalogue (pass 2, BAJAOVRLAY-43)

The same moves serve every new graphic: the rise (each piece rises `--motion-in-offset` and
fades up in `--motion-in`, `--ease-out`), the lift (every piece together, `--motion-out`,
`--ease-in`), the crossfade of a state (`--motion-flag`: the new fades in over the old,
nothing moves) and the page turning in place (`--motion-strip-page`: the old pieces lift
away while the new rise into the same places, `--motion-page-stagger` apart, so it never
goes empty). What differs is the order of the pieces, the holds and what a button does.
Nothing is scrolled, pulsed or spun; a number that changes on air changes in place (read,
not watched). Each graphic below is exactly what its demo page does, with the demo's buttons
in brackets.

- **Team card** [Entrar, Sair]: the whole card rises; its photo and logo come with it, never
  after. Out: the card lifts. With or without photo, logo and city, the same motion on a
  card of another width.
- **Battle card** [Entrar, Sair, Atualizar]: the car ahead's pill, the gap card
  `--motion-lead` behind it, the car behind's pill `--motion-lead` after that; out together.
  Atualizar brings the next lap's reading: the gap number changes in place; the trend cell
  crossfades only when its word changes (closing to opening, say), and when the word stays
  only its number changes in place. A state, not an animation.
- **Standings, overall with points per event** [Entrar, Sair]: the head card, then
  `--motion-lead` later the column head and each row `--motion-row-stagger` after the one
  above (20 rows are in at 100 + 20 × 30 + 400 = 1.1 s). Every `--motion-board-hold` the page
  turns: the rows lift out together, the next page's rows cascade in, the head stays and its
  page line changes ("2/3 · 21º A 40º"). Out: everything together.
- **Standings in columns** (one event, or the overall total only) [Entrar, Sair]: the head,
  then the three columns at once, each cascading from its top, so row n of every column
  enters at the same moment and the whole field fills in one sweep. No pages.
- **Bracket** [Entrar, Sair, Próximo]: Entrar brings the head and step 1. A round board's
  match cards cascade `--motion-row-stagger` apart, down the left column then the right, each
  card whole (both cars together: a match arrives as a match; 32 cards are in at
  100 + 32 × 30 + 400 = 1.5 s). Próximo from a board: the cards lift out together, the head's
  round name and step count change, the next board's cards (or the tree) cascade in. The
  tree's first step brings every round name at once, then `--motion-lead` later the first
  round's pills top to bottom; each further Próximo adds the next round's pills, and the
  lines leading into a round fade in (`--motion-flag`) once its last pill is in. What is on
  screen never moves. A loser, a W.O. and a bye enter in their own look (a loser rises to
  its dimmed opacity, not past it). Out: everything together. A result arriving while a
  match is on screen would crossfade its result cell and turn the winner's chip green in
  `--motion-flag`; no demo has a button for it.
- **Podium** [Entrar, Sair, Próximo]: Entrar brings the head only. Each Próximo raises one
  card `--motion-podium-offset` in `--motion-in`: 3rd, then 2nd, then 1st. The cards not yet
  revealed keep their room, invisible, so nothing shifts. Out: the head and the revealed
  cards together.
- **Fastest lap, penalty or incident** [Entrar, Sair, Novo evento]: the card rises and,
  after `--motion-notice-hold`, lifts out by itself. Novo evento sends the next notice: with
  the slot empty it rises at once; with a notice up, the new one waits until the one on air
  has been up `--motion-notice-min-hold` (so it can be read), then the old one lifts out and
  the new one rises, one after the other, never two at once. Several close together queue
  in the order they came, each staying at least the minimum. Sair takes the notice off early
  and drops the queue. With or without the lap number, with or without a sanction, the same
  motion.
- **Countdown, card** [Entrar, Sair]: the whole card, as the race clock; the count changes in
  place every second and stops at "0:00". On air it takes the clock layer after the race
  clock leaves (the layer's replace policy, out then in).
- **Countdown, full screen** [Entrar, Sair]: the head, the body card `--motion-lead` behind;
  the count as above.
- **Sessions board** [Entrar, Sair, Atualizar]: the head, then each slot `--motion-row-stagger`
  after the one above; out together. Atualizar ends the slot in progress and starts the
  next: each state cell crossfades and the row's slate (the denser one marks the slot in
  progress) follows it, both in `--motion-flag`.
- **Intermission board** [Entrar, Sair]: the head; `--motion-lead` later the next-session
  card and the top-five head; the five rows `--motion-row-stagger` apart after the top-five
  head; the sponsor line `--motion-lead` after the last row starts; out together. Without the
  top five or the sponsor line the remaining pieces keep their timing. The count changes in
  place. The sponsor line turns through every sponsor, a level at a time (its heading, then up
  to four logos), the heading and logos lifting away as the next page's rise into the same
  place in `--motion-strip-page`, `--motion-page-stagger` apart; each page stays its level's
  hold.
- **Every sponsor round** (the three below and the intermission's line) goes Diamante, Ouro,
  Prata, Apoio, then "Realização" (SAE Brasil, the organiser) last, each page or sponsor held
  by its level: `--motion-sponsor-hold-<level>`, 8 s for Diamante, 5 s for Ouro, 3 s for Prata
  and Apoio, 5 s for Realização. A level with more sponsors than a page holds shares them
  evenly between its pages (nine Ouro on pages of four are 3 + 3 + 3).
- **Sponsor roll, full screen** [Entrar, Sair, Atualizar]: the head, then the tiles
  `--motion-row-stagger` apart in reading order. When its level's hold is up the page turns in
  place; Atualizar turns it now and starts the hold again. Each page is one sponsor level:
  its heading in the head ("PATROCÍNIO OURO", "APOIO", "REALIZAÇÃO") changes in place with
  the page. The grid keeps two rows on a short page, so the board and its head never move.
- **Sponsor roll, corner** [Entrar, Sair, Atualizar]: the bug's card rises; when the sponsor's
  level hold is up its sponsor cell (heading and logo) crossfades to the next, the event logo
  and word never moving; Atualizar crossfades now and starts the hold again.
- **QR card** [Entrar, Sair]: the whole card; nothing moves while it is up, since a moving code
  does not scan.
- **Message ticker** [Entrar, Sair]: as the strip: the clock block (when shown), the label, the
  message and the page cell, `--motion-row-stagger` apart. Every `--motion-strip-hold` the
  message turns in place and the page cell's number changes in place. Out together.

## The demo pages

`motion-demo.html` (pass 1) loops: tower set in → flag to yellow → positions 3 and 4 trade →
a new leader (1 and 2 trade) → the tower turns to page 2 (cars 21–40), page 3 (41–60, with
the wrench and the retired icons) and back to page 1 → flag back to green → tower set out →
strip and lower third in → two page turns → out. It shortens the 7 s page hold to 3 s so the
loop stays watchable; every other number is the token above. Web Animations API only.

The catalogue has one demo page per graphic and per combination of its optional parts
(`motion-<graphic>-<parts>.html`, 30 pages), all linked from `motion-catalogo.html`. Each is
the graphic over the footage with a bar above the title-safe area: the buttons named above
and a status line saying what just moved and for how long, in the tokens' own values. They
use GSAP 3.15 with CustomEase, as the product's graphics do, from a byte-for-byte copy in
`../../vendor/gsap` (nothing from the network, no `node_modules` needed), and read every duration,
offset and curve from `tokens.css` the way `packages/theme`'s `readMotionTokens` and
`gsapEaseOfToken` do: milliseconds and pixels from the custom properties, each cubic-bezier
registered as a CustomEase with exactly its curve. No hold is shortened: a standings page
waits its real 10 s. Shared code: `../../tools/motionDemoCore.js` (the token reading, the
moves, the buttons), `motionDemoCards.js`, `motionDemoBoards.js` and `motionDemoSponsors.js` (one entry per graphic);
the pages are generated by `generatePages.mjs` through `slateMotionDemos.mjs` and
`slateMotionPages.mjs`.

## The timelines

Two pages replay the real results, so the motion can be judged with real data at any moment
of the day. Both have the usual top bar (Entrar, Sair, the status line) and a second bar under
the title-safe area (y 1032..1074) with the moment shown, a slider over the whole day and the
transport buttons. Dragging the slider jumps with no motion (it is a search, not a playback);
every button step plays the real motion.

- **Enduro** (`motion-enduro-linha-do-tempo.html`) [Entrar, Sair, Detalhada/Compacta, Pág.;
  Início, −1 min, ‹ Passagem, Play, Passagem ›, +1 min, Fim, 1×/10×/60×]: the race clock, the
  compact or the detailed tower and the fastest-lap notice, from the lap passes of
  `enduro_passes.xlsx`. Entrar brings the clock, then `--motion-lead` later the tower head and
  rows `--motion-row-stagger` apart. A step of a pass or a minute redraws the moment: the time
  and the leader's laps change in place, a car that changed place slides there in
  `--motion-swap` with its ▲ or ▼ and coloured position held `--motion-cue-hold`, a car that
  crosses the line for the first time rises into its row, a flag change (green to checkered at
  4 h) crossfades the band in `--motion-flag`, and a new fastest lap rises into the notice slot
  and leaves after `--motion-notice-hold`. A move longer than a minute jumps. Play runs the
  race at the chosen speed, frame by frame, with the same motion. Pág. shows positions 21–34;
  the tower switch cascades the other tower in.
- **Super Prime** (`motion-super-prime-linha-do-tempo.html`) [Entrar, Sair; Início,
  ‹ Anterior, Próximo, Fim]: the bracket decided one match per step, in the order the day ran
  (the third-place match before the final), from step 0, the draw with its byes already
  through by W.O. A slot whose car is not known yet reads "A DEFINIR" in the dashed outline of
  a bye; a match not run yet shows "—" for both cars. At each step the slots that changed fade
  in place in `--motion-in` and the match just decided is outlined for `--motion-cue-hold`.
  The view follows the match: the round boards (32 avos, 16 avos, oitavas), then the tree;
  a change of view lifts the old pieces out together and cascades the new ones in
  `--motion-page-stagger` apart.
