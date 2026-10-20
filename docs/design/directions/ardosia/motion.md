# ardosia — motion

The existing scoreboard slides its rows in from below, one every 300 ms, and lifts them out
in reverse. This direction keeps that language and makes it broadcast-fast: every piece rises
20 px into place and fades up, and the rows cascade with a short stagger instead of a slow
one. Every duration, offset, stagger and easing is a token in `tokens.css` (`--motion-*`,
`--ease-*`), and the shared demo script (`../../tools/slateMotionDemo.js`, loaded by
`motion-demo.html`) reads them from there, so the demo and this page cannot drift apart.

| Token | Value | Where |
| --- | --- | --- |
| `--motion-in` | 400 ms, `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) | every piece entering |
| `--motion-in-offset` | 20 px | the rise on entry, the lift on exit |
| `--motion-row-stagger` | 30 ms per pill | tower rows and strip cells, top to bottom and left to right |
| `--motion-lead` | 100 ms | the tower starts this long after the clock; the bug too |
| `--motion-out` | 250 ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0) | every piece leaving |
| `--motion-flag` | 300 ms, `--ease-out` | the new flag band fades in over the old |
| `--motion-swap` | 400 ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) | two pills trading places |
| `--motion-cue-hold` | 2000 ms | the ▲ / ▼ and the coloured position cell after a swap |
| `--motion-strip-page` | 300 ms | a strip page turning |
| `--motion-strip-hold` | 7000 ms | a strip page stays still this long |

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
word crossfade together), then replaces it. Nothing moves: a flag change must read as a
state, not as an animation.

## Position change (400 ms, then 2 s)

Pills keep their position number with the slot and trade places: the two pills slide from
where they were to where they now are (FLIP, 400 ms ease-in-out), so the yellow numbers stay
in order and the cars move. The car that moved up shows a small green ▲ in the cue lane after
its position, and its position cell turns green for 2 s; the car that moved down shows a blue
▼ and a blue cell. When the swap makes a new leader, the green leader chip simply follows
slot 1. Several cars changing in one update slide together in the same 400 ms.

## The lower strip

Pages of 6 cars (README "The lower strip"), each held 7 s. On a page change the old pills lift
away and the new pills rise in, 300 ms each, cascading 15 ms apart (half the row stagger), so
the bar never goes empty and never scrolls: scrolled text smears under stream compression and
cannot be read on a phone while it moves; a still page can.

## The demo page

`motion-demo.html` loops: tower set in → flag to yellow → positions 3 and 4 trade → a new
leader (1 and 2 trade) → flag back to green → tower set out → strip and lower third in → two
page turns → out. It shortens the 7 s page hold to 3 s so the loop stays watchable; every
other number is the token above. Web Animations API only, nothing loaded from the network.
