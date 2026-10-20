# Faixa — motion

One gesture, the 12° edge, is also the one way things move: everything enters and leaves
along that edge, and the clock's flag changes by sliding a new stripe in. Durations and
easings are the `--motion-*` and `--ease-*` tokens in `tokens.css`.

## In and out (every plate)

| Graphic | In | Out |
| --- | --- | --- |
| Race clock | Angled clip-path wipe, left to right, 300 ms `--ease-out`. The clip polygon's moving edge is the 12° edge, so the plate is revealed by its own stripe. | The same wipe reversed (the edge travels right to left), 220 ms `--ease-in`. |
| Compact and detailed tower | The plate wipes in as above (300 ms), then the rows "deal in" from the top: each row from opacity 0 and `translateY(-8px)` to its place, 300 ms `--ease-out`, 15 ms stagger per row (23 rows settle in 0.65 s). | Plate wipe reversed, 220 ms. Rows do not animate out one by one: the plate's wipe takes them. |
| Lower strip | Angled wipe left to right, 300 ms. The clock block, the cars and the page cell are revealed in one pass. | Reversed wipe, 220 ms. |
| Lower third | Angled wipe, 300 ms, started 1 s after the strip when both come up together (so the eye lands on the name second). | Reversed wipe, 220 ms. |
| Sponsor bug | Angled wipe, 300 ms, the edge entering from its own cut corner. | Reversed wipe, 220 ms. |

The wipe polygon starts 40 px outside the plate so the box shadow is revealed with it and
never looks clipped once the plate is at rest, and its moving edge is the 12° edge: the edge's
run is the polygon's height × tan 12° (0.2126 × height, the 40 px margins counted), so every
plate is revealed by its own stripe. In the demo that is 53.8 px for the clock (253 px tall
with its margins), 81.9 for the 8-row tower, 60.4 for the bug, 32.3 for the strip and 52.1 for
the lower third.

## Flag change (race clock, 300 ms)

The clock keeps the current band in place and slides the new band in over it along the
band's own axis, `translateX(-110%)` to `0`, 300 ms `--ease-out`. The angled end cap leads,
so the colour sweeps in like a flag being pulled across. The word travels with its band, and
so does the plate's navy bottom rule, which is painted on the band: there is never a frame
with the old word on the new colour or a bare bottom edge. The strip's flag cell changes the
same way at the same moment.

## Position change (towers, 380 ms + 2 s)

Rows trade places by `translateY` over whole row heights (32 px compact, 36 px detailed),
380 ms `--ease-in-out`, every affected row moving at once. The position cell of a car that
moved up turns `--position-up` (green) with a solid up-pointing triangle after the number; a
car that moved down turns `--position-down` (blue) with a down-pointing triangle. The triangle
is a 14 px inline SVG like the status icons, not a text character: Saira has no triangle
glyph, and a character would take whatever font the OBS machine substitutes. The position cell
is 52 px so a two-digit position with the mark fits (48 px compact, 45.5 px detailed). The
colour and mark hold for 2 s (`--motion-highlight-hold`), then the cell returns to navy. In the towers the leader's cell is always green, so a car
taking the lead simply keeps the green (the strip's position cells are all navy, so there a
new leader simply arrives in the first slot). Rows are not re-rendered during the move: the number in the cell
cross-fades during the 380 ms so the row never shows two positions at once.

Why colour plus a mark: colour alone would not survive the dust-orange footage at 720p, and
green is already the leader's colour. The arrow is the meaning; the colour is the emphasis.

## Lower strip pages (400 ms every 7 s)

The strip shows 5 cars per page in equal cells, 12 pages for 60 cars (`sample-data.json`),
and turns the page every 7 s (`--motion-strip-hold`). Every cell is one fifth of the car area
whatever it holds, so no page stretches: a page with fewer cars shows them in cells of the
same width and leaves the rest of the bar empty, and the hairlines stand still from page to
page. The new page is revealed over the old with an angled left-to-right clip wipe, 400 ms
`--ease-in-out`, the wipe's edge at 12° like every other (run = the car area's 69 px × tan 12°,
14.7 px); the page cell cross-fades from `1/12` to `2/12` in the same 400 ms. The clock block
never moves.

Paging, not scrolling: a scrolling ticker keeps every cell in motion, so a viewer can never
read a line at rest, and the moving text fights the footage behind it. A page sits still for
7 s, long enough to read five cells twice, and the wipe is the same gesture as every other
entrance, so it reads as "next" and not as "something changed in the race".

## What motion-demo.html shows

A 14 s loop with no JavaScript (CSS keyframes only), on the stage with the race clock,
an 8-row compact tower, the sponsor bug, the lower strip and the lower third:

- 0 to 1.5 s: every plate wipes in with the angled edge, 300 ms each (the clock at 0 s, the
  tower at 0.1 s, the strip at 0.2 s, the bug at 0.3 s); the tower's rows deal in with the
  15 ms stagger; the lower third comes up last, 1 s after the strip, at 1.2 s.
- 3 s: the flag changes from green to yellow: the yellow band (word `AMARELA`, from the
  sample's yellow session) slides in over the green one.
- 5 s: cars in positions 2 and 3 trade places; the cell of the car that moved up turns green
  with the up triangle and the other turns blue with the down triangle, for 2 s.
- 8 s: the strip turns from page 1 to page 2 with the angled wipe (400 ms); `1/12` becomes
  `2/12`.
- 11 s: everything wipes out, reversed, and the loop restarts.

The screenshot tool skips the demo. Open it in a browser from the file system.

## A detail that makes the swap work

The towers' alternate stripes are painted on the row container (a repeating gradient of one
row height), not on the rows. Rows are transparent except for their navy position cell, so
when two rows trade places they slide over a fixed white/grey pattern and the striping is
intact the moment they land. The demo shows this: after the swap at 5 s, row 2 is still white
and row 3 still grey.
