# marinho — motion

Chips pop into place: every piece rises 12 px, scales from 92% to 100% with a slight
overshoot and fades up, so the badges land like stickers. Every duration, offset, scale,
stagger and easing is a token in `tokens.css` (`--motion-*`, `--ease-*`), read at run time by
the shared demo script (`../../tools/slateMotionDemo.js`, loaded by `motion-demo.html`), so
the demo and this page cannot drift apart.

| Token | Value | Where |
| --- | --- | --- |
| `--motion-in` | 360 ms, `--ease-out` cubic-bezier(0.2, 0.9, 0.3, 1.1) (a 10% overshoot) | every piece entering |
| `--motion-in-offset` | 12 px | the rise on entry, the lift on exit |
| `--motion-in-scale` | 0.92 | the scale a piece starts from |
| `--motion-row-stagger` | 24 ms per pill | tower rows and strip cells |
| `--motion-lead` | 90 ms | the tower (and the bug) start this long after the clock |
| `--motion-out` | 220 ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0) | every piece leaving |
| `--motion-flag` | 300 ms, `--ease-out` | the new flag band fades in over the old |
| `--motion-swap` | 420 ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) | two pills trading places |
| `--motion-cue-hold` | 2000 ms | the ▲ / ▼ and the coloured position chip after a swap |
| `--motion-strip-page` | 320 ms | a strip page turning |
| `--motion-strip-hold` | 6000 ms | a strip page stays still this long |

## In and out, per graphic

- **Race clock**: the card pops in (rise, scale, fade) in 360 ms; out in 220 ms, lifting and
  fading without the scale.
- **Compact and detailed towers**: head pill 90 ms after the clock, then one row every 24 ms;
  with 20 rows the last starts at 90 + 20 × 24 = 570 ms and is in at 0.93 s. All pills leave
  together in 220 ms.
- **Lower strip**: clock block, then the car pills 24 ms apart, then the page cell; out together.
- **Lower third**: name pill, then the role pill 90 ms behind. Out together.
- **Sponsor bug**: the card alone; never pulses or cycles.

## Flag change (300 ms)

The new band fades in over the old at the bottom of the clock card; colour and word crossfade
together, nothing slides.

## Position change (420 ms, then 2 s)

FLIP: the two pills slide from their old place to their new one in 420 ms, the position chips
staying with the slots. The car that moved up shows a green ▲ in the cue lane and its white
position chip turns green for 2 s; the car that moved down a blue ▼ and a brand-blue chip.
The green leader chip follows slot 1.

## The lower strip

Pages of 5 cars (README "The lower strip"), held 6 s. On a page change the old pills lift
away and the new pills pop in, 320 ms, cascading 12 ms apart. The strip never scrolls:
scrolled text smears under stream compression and cannot be read on a phone while it moves.

## The demo page

`motion-demo.html` loops: tower set in → flag to yellow → positions 3 and 4 trade → a new
leader → flag back → tower set out → strip and lower third in → two page turns → out. The
6 s page hold is shortened to 3 s in the demo; every other number is the token above. Web
Animations API only, nothing loaded from the network.
