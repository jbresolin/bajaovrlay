# ardosia — motion

The existing scoreboard slides its rows in from below, one every 300 ms, and lifts them out
in reverse. This direction keeps that language and makes it broadcast-fast: every piece rises
20 px into place and fades up, and the rows cascade with a short stagger instead of a slow
one. Every duration, offset, stagger and easing is a token in `tokens.css` (`--motion-*`,
`--ease-*`), and the shared demo script (`../../tools/slateMotionDemo.js`, loaded by
`motion-demo.html`) reads them from there, so the demo and this page cannot drift apart.

| Token                   | Value                                                  | Where                                                         |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `--motion-in`           | 400 ms, `--ease-out` cubic-bezier(0.16, 1, 0.3, 1)     | every piece entering                                          |
| `--motion-in-offset`    | 20 px                                                  | the rise on entry, the lift on exit                           |
| `--motion-row-stagger`  | 30 ms per pill                                         | tower rows and strip cells, top to bottom and left to right   |
| `--motion-lead`         | 100 ms                                                 | the tower starts this long after the clock; the bug too       |
| `--motion-out`          | 250 ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0)      | every piece leaving                                           |
| `--motion-flag`         | 300 ms, `--ease-out`                                   | the new flag band fades in over the old                       |
| `--motion-swap`         | 400 ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) | two pills trading places                                      |
| `--motion-cue-hold`     | 2000 ms                                                | the ▲ / ▼ and the coloured position cell after a swap         |
| `--motion-strip-page`   | 300 ms                                                 | a strip page turning                                          |
| `--motion-strip-hold`   | 7000 ms                                                | a strip page stays still this long                            |
| `--motion-notice-hold`  | 8000 ms                                                | a notice (fastest lap, penalty) leaves by itself after this   |
| `--motion-board-hold`   | 10000 ms                                               | a standings page stays still this long                        |
| `--motion-sponsor-hold` | 5000 ms                                                | a sponsor roll page, or the corner's sponsor, stays this long |

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

The same two motions, the rise (`--motion-in`) and the lift (`--motion-out`), serve every new
graphic; what differs is the order of the pieces, the holds and, for the two stepped
graphics, what a "Next" does. Nothing new is scrolled, pulsed or spun.

- **Team card**: the card alone, as the lower third's name pill (400 ms in, 250 ms out). The
  photo cell fades up with the card, never separately. A card without media is the same
  motion on a shorter card.
- **Battle card**: the car ahead's pill, the gap card 100 ms behind it (`--motion-lead`), the
  car behind's pill 100 ms after that; out together. On air the gap number changes in place
  (read, not watched) and the trend cell crossfades in 300 ms (`--motion-flag`) when the word
  changes, like a flag band: a state, not an animation.
- **Standings, overall**: the head card, then the column-head pill and each row 30 ms after the
  one above it (the tower's cascade; 20 rows are in at 100 + 20 × 30 + 400 = 1.1 s). Pages
  turn as the tower's do, on `--motion-board-hold` (10 s, longer than the strip's because a
  page holds 20 teams and seven numbers each): the rows leave together and the next page's
  rows cascade in, the head staying. Out: everything together.
- **Standings, per event**: the three columns cascade at once, each column its own cascade
  from the top (row n of every column enters at the same moment), so the field fills in one
  sweep of 1.1 s. No pages.
- **Bracket, round boards**: the head, then the match cards 30 ms apart down the left column
  and then the right, each card whole (both cars together, never one car before the other:
  a match arrives as a match); 32 cards are in at 100 + 32 × 30 + 400 = 1.5 s. "Next" turns
  to the next board as a standings page turns: the cards leave together and the next round's
  cascade in, the head staying with its new round name.
- **Bracket, tree**: the first tree step brings the head (or keeps it, after a board), every
  round-name pill (100 ms after the head), then the first round's pills top to bottom, 30 ms
  apart; the lines of a round fade in (300 ms) once its last pill is in. Each "Next" adds a
  round the same way: its pills cascade in and its lines fade; what is on screen never
  moves. On a board or in the tree, a result arriving on air changes its match in place: the
  winner's chip turns green, the loser dims and the result cell (a time, a count of wins or
  the winner's mark) crossfades, in 300 ms. Out: everything together.
- **Podium**: the head first; each "Next" raises one card from 40 px below (twice the usual
  offset, the "three cards rising" of the README) in 400 ms: 3rd, then 2nd, then 1st. The
  cards not yet revealed keep their room, invisible, so nothing shifts. Out: the three cards
  together, the head with them.
- **Fastest lap and the penalty notice**: the card rises in; it holds `--motion-notice-hold`
  (8 s) and lifts out by itself. A notice taken while one is on air replaces it: the old one
  out (250 ms), the new one in (400 ms), never two at once. The operator can clear it early.
- **Countdown, card**: as the race clock; a countdown replacing the clock on the clock layer
  follows the layer's replace policy (out, then in). The count changes in place.
- **Countdown, full screen**: the head, then the body card 100 ms behind. The count changes
  in place; when it reaches zero it reads "0:00" and stays until cleared.
- **Sessions board**: the head, then each slot pill 30 ms after the one above it; out
  together. A slot changing state (concluída, em andamento) crossfades its status cell in
  300 ms and the row's denser slate with it.
- **Intermission board**: the head, the two body cards 100 ms behind it (the next-session
  card and the top-five head pill), then the five rows 30 ms apart, then the sponsor line
  100 ms after the last row; out together. The count changes in place.
- **Sponsor roll, full screen**: the head, then the six tiles 30 ms apart, reading order; a
  page turns on `--motion-sponsor-hold` (5 s) as a strip page does: the tiles lift away and the
  next page's tiles rise in. Corner: the bug's card as always; the sponsor cell crossfades
  (300 ms) to the next sponsor on the same hold, the logo and the event word never moving.
- **QR card**: the card alone, in and out; nothing moves while it is up, since a moving code
  does not scan.
- **Message ticker**: as the strip: the clock block, the label pill, the message pill, then
  the page cell, 30 ms apart; a message changes as a strip page does (300 ms, held 7 s).

## The demo page

`motion-demo.html` loops: tower set in → flag to yellow → positions 3 and 4 trade → a new
leader (1 and 2 trade) → the tower turns to page 2 (cars 21–40), page 3 (41–60, with the
wrench and the retired icons) and back to page 1 → flag back to green → tower set out →
strip and lower third in → two page turns → out. It shortens the 7 s page hold to 3 s so the loop stays watchable; every
other number is the token above. Web Animations API only, nothing loaded from the network.
The demo covers pass 1; the catalogue's motion is described above and not demonstrated.
