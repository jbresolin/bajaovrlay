# grafite — motion

The scoreboard's slide-in, made quiet: pieces rise 16 px and fade up, quickly, with a short
cascade, and nothing moves that does not carry information. Every duration, offset, stagger
and easing is a token in `tokens.css` (`--motion-*`, `--ease-*`), read at run time by the
shared demo script (`../../tools/slateMotionDemo.js`, loaded by `motion-demo.html`), so the
demo and this page cannot drift apart.

| Token | Value | Where |
| --- | --- | --- |
| `--motion-in` | 280 ms, `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) | every piece entering |
| `--motion-in-offset` | 16 px | the rise on entry, the lift on exit |
| `--motion-row-stagger` | 16 ms per pill | tower rows and strip cells |
| `--motion-lead` | 80 ms | the tower (and the bug) start this long after the clock |
| `--motion-out` | 180 ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0) | every piece leaving |
| `--motion-flag` | 250 ms, `--ease-out` | the new flag band fades in over the old |
| `--motion-swap` | 380 ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) | two pills trading places |
| `--motion-cue-hold` | 2000 ms | the ▲ / ▼ and the coloured position cell after a swap |
| `--motion-strip-page` | 250 ms | a strip page turning |
| `--motion-strip-hold` | 7000 ms | a strip page stays still this long |

## In and out, per graphic

- **Race clock**: the card rises 16 px and fades up in 280 ms; out in 180 ms.
- **Compact and detailed towers**: head pill 80 ms after the clock, then one row every 16 ms;
  with 21 rows the last starts at 80 + 21 × 16 = 416 ms and is in at 0.7 s. All pills leave
  together in 180 ms.
- **Lower strip**: clock block, then the car pills 16 ms apart, then the page cell; out together.
- **Lower third**: name pill, then the role pill 80 ms behind. Out together.
- **Sponsor bug**: the card alone; never pulses or cycles.

## Flag change (250 ms)

The new band fades in over the old at the bottom of the clock card; colour and word crossfade
together, nothing slides.

## Position change (380 ms, then 2 s)

FLIP: the two pills slide from their old place to their new one in 380 ms, the position
numbers staying with the slots. The car that moved up shows a green ▲ in the cue lane and a
green position cell for 2 s; the car that moved down a blue ▼ and a blue cell. The white
leader chip follows slot 1.

## The lower strip

Pages of 6 cars (README "The lower strip"), held 7 s. On a page change the old pills lift
away and the new pills rise in, 250 ms, cascading 8 ms apart. The strip never scrolls:
scrolled text smears under stream compression and cannot be read on a phone while it moves.

## The demo page

`motion-demo.html` loops: tower set in → flag to yellow → positions 3 and 4 trade → a new
leader → flag back → tower set out → strip and lower third in → two page turns → out. The
7 s page hold is shortened to 3 s in the demo; every other number is the token above. Web
Animations API only, nothing loaded from the network.
