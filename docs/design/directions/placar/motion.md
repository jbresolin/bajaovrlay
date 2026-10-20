# placar — motion

Every movement is a wipe or a slide; nothing fades, scales or bounces, because a timing board
is a thing that is either there or not. Every duration, lead, stagger and easing is a token in
`tokens.css` (`--motion-*`, `--ease-*`) and `motion-demo.js` reads them from there (the only
numbers of its own are the pauses between the demo's steps), so the demo and this page cannot
drift apart.

| Token | Value |
| --- | --- |
| `--motion-in` | 260ms, `--ease-out` cubic-bezier(0.16, 1, 0.3, 1) |
| `--motion-out` | 200ms, `--ease-in` cubic-bezier(0.7, 0, 0.84, 0) |
| `--motion-row-stagger` | 18ms per row, top to bottom |
| `--motion-lead` | 80ms: a following piece starts this long after the one it follows (tower after clock, name plate after strip, role row after name plate) |
| `--motion-bug-lead` | 60ms: the sponsor bug after the clock |
| `--motion-out-stagger` | 6ms per tower piece on the way out |
| `--motion-flag` | 300ms, `--ease-out` |
| `--motion-swap` | 400ms, `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1) |
| `--motion-cue-hold` | 2000ms |
| `--motion-strip-page` | 150ms, linear |
| `--motion-strip-hold` | 7000ms |

## In and out, per graphic

The wipe is `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`: the plate is revealed from its
left edge, spine first, so the green spine is the first thing to appear and the last to leave.

- Race clock: one wipe, in 260ms ease-out, out 200ms ease-in (wipe back to the left).
- Compact and detailed towers: the tower starts one lead (80ms) after the clock, so the clock
  leads; the header wipes first, then each row 18ms after the one above it, every piece its
  own 260ms wipe. The header starts at 80ms and row n (counting from 0) at 80 + 18(n + 1) ms,
  so 24 rows are all in after 80 + 24 × 18 + 260 = 772ms. The rows paint their own navy and
  spine, so the stagger shows rows arriving, not a plate filling up. Out: every piece wipes
  back in 200ms with a 6ms stagger (`--motion-out-stagger`), so the tower leaves as one.
- Lower strip: one wipe, in 260ms, out 200ms. The left clock block, the car cells and the
  page indicator are one plate and move together.
- Lower third: two pieces. The name plate wipes in (260ms) and the role row starts one lead
  (80ms) behind it; when the lower third enters with the strip (combo-strip), the name plate
  starts one lead after the strip, so the role row is fully in at 80 + 80 + 260 = 420ms. Out:
  both pieces together in 200ms.
- Sponsor bug: one wipe, in 260ms (`--motion-bug-lead`: 60ms after the clock when they enter
  together), out 200ms.

## Flag change

The new band wipes in from the left over the old one in 300ms ease-out; the old band is
removed when the wipe completes. The strip's flag cell does the same. The flag word changes
with the colour, never before it.

## Position change in the tower (FLIP)

When the order changes, rows trade places in the DOM and the position numbers stay with the
slots (the cell that reads "3" keeps reading "3"; the car in it changes), and so does the
leader's green: whichever row sits in slot 1 has the green cell. Each row then slides from
where it was to where it now is: `translateY` over 400ms ease-in-out. For 2 s after the slide
starts, the car that moved up shows its position cell and the 16px cue lane right after it in
brand green, with a white ▲ (a 14 x 10 SVG, 9 x 7 at 720p) centred in the lane; the car that
moved down shows brand blue with ▼. A green cell is inset 4px from the spine, like the
leader's (README "Tower rows"), so the cue never merges with the spine into one green block;
the blue cell keeps the full column. The lane is empty navy at every other time, so the
triangle never sits on top of a two-digit position. Shape and colour both change, so the cue
works on a monochrome stream too.

A new leader's cell is green already, so it gets a second cue that is not colour on the
position cell: its car-number cell is set on the lighter navy (`#0B4F8F`) for the same 2 s,
together with the ▲ in the lane; the car that lost the lead shows the blue cell and ▼ as any
other mover. A value changing without a move (laps, gap, last lap) does not animate: tabular
figures keep the column still. A car becoming retired dims its cells to 55% over 300ms (the
row's navy and spine stay opaque); the status icon appears without animation.

## Lower strip pages

Ten cars per page, 7 s per page, six pages for sixty cars. The next page is laid over the
current one and wiped in from the left in 150ms, linear, so the change reads as a hard cut
with a direction; the page indicator ("1/6") updates when the wipe completes. Paging rather
than scrolling, because a scrolling ticker smears under stream compression, judders in OBS
when the frame rates are not multiples, and cannot be read on a phone while it moves; a page
that stands still for 7 s can be read by anyone.

## What motion-demo.html shows

A loop over real sample data, with a caption plate at the right (its bottom at y 940, the lower
third's bottom, so it never covers the strip or its page indicator) naming the current step.
Every pass starts from the sample's order (the two trades are undone before the tower comes
back: car 31 leads, 38 is second, 25 third), so every pass tells the same story:
the tower set (clock, compact tower, bug) wiping in with the row stagger; the flag changing
from VERDE to AMARELA; positions 3 and 4 trading places with the ▲ and ▼ cues; then positions
1 and 2 trading places, so the new leader's ▲ and lighter-navy number cell can be seen; the
flag back to VERDE; the tower set wiping out; the strip and lower third wiping in (the name
plate, then the role row); the strip turning to page 2 and back to page 1 with the 150ms wipe
(the demo holds each page 3 s instead of 7 s so the loop stays short); the strip set wiping
out. Open the file in a browser; it uses the Web Animations API only (`motion-demo.js`, beside
it) and loads nothing from the network.
